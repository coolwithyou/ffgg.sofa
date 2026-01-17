// inngest/functions/validate-claims.ts

/**
 * Validate Claims Inngest Function
 *
 * 문서 검증 파이프라인을 조율하는 Inngest 함수입니다.
 * 3단계 검증 시스템: Regex → LLM → Human
 *
 * 파이프라인:
 * 1. 세션 정보 조회 및 상태를 'analyzing'으로 업데이트
 * 2. 원본 텍스트를 마크다운으로 재구성 (없는 경우)
 * 3. 재구성된 마크다운에서 Claim 추출
 * 4. 원본 텍스트와 정규식 검증
 * 5. LLM 검증 (pending 상태인 claim만)
 * 6. 위험도 점수 계산
 * 7. 세션 상태를 'ready_for_review'로 업데이트
 */

import { inngestClient } from '../client';
import { db } from '@/lib/db';
import { validationSessions, claims } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  extractClaims,
  verifyWithRegex,
  verifyWithLLM,
  calculateRiskScore,
  reconstructAndSave,
} from '@/lib/knowledge-pages/verification';
import type { ValidationStatus, ProcessingStep } from '@/lib/knowledge-pages/types';

/**
 * Progress 정보 타입
 */
interface ProgressUpdate {
  currentStep?: ProcessingStep;
  completedSteps?: number;
  totalSteps?: number;
  processedClaims?: number;
}

/**
 * 세션 상태 업데이트 헬퍼
 * @param sessionId - 세션 ID
 * @param status - 검증 상태
 * @param progress - 진행 상태 (선택)
 * @param additionalData - 추가 데이터 (선택)
 */
async function updateSessionStatus(
  sessionId: string,
  status: ValidationStatus,
  progress?: ProgressUpdate,
  additionalData?: Record<string, unknown>
) {
  await db
    .update(validationSessions)
    .set({
      status,
      updatedAt: new Date(),
      ...(progress && {
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
        totalSteps: progress.totalSteps,
        processedClaims: progress.processedClaims,
      }),
      ...additionalData,
    })
    .where(eq(validationSessions.id, sessionId));
}

/**
 * Validate Claims Inngest Function
 */
export const validateClaimsFunction = inngestClient.createFunction(
  {
    id: 'validate-claims',
    name: 'Validate Document Claims',
    retries: 2,
    onFailure: async ({ event, error }) => {
      // onFailure 이벤트에서 원본 이벤트 데이터는 event.data.event.data에 있음
      const failureEvent = event as unknown as {
        data: {
          event: {
            data: {
              sessionId: string;
              chatbotId: string;
              tenantId: string;
            };
          };
        };
      };

      const originalData = failureEvent.data.event?.data;
      if (!originalData?.sessionId) {
        console.error('[validate-claims] onFailure: Missing session data');
        return;
      }

      const { sessionId } = originalData;
      console.error(`[validate-claims] Failed for session ${sessionId}:`, error);

      // 실패 시 세션 상태를 rejected로 업데이트
      try {
        await updateSessionStatus(sessionId, 'rejected', {
          reviewNote: `검증 실패: ${(error as Error).message || 'Unknown error'}`,
        });
      } catch (updateError) {
        console.error('[validate-claims] Failed to update session status:', updateError);
      }
    },
  },
  { event: 'knowledge-pages/validate-document' },
  async ({ event, step }) => {
    const { sessionId, chatbotId, tenantId } = event.data;

    console.log(`[validate-claims] Starting validation for session: ${sessionId}`);
    console.log(`[validate-claims] Event data:`, JSON.stringify(event.data, null, 2));

    // Step 1: 세션 정보 조회 및 상태 업데이트 (analyzing)
    const session = await step.run('fetch-session', async () => {
      console.log(`[validate-claims:fetch-session] Fetching session: ${sessionId}`);

      const result = await db
        .select()
        .from(validationSessions)
        .where(eq(validationSessions.id, sessionId))
        .then((rows) => rows[0]);

      if (!result) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      console.log(`[validate-claims:fetch-session] Session found:`, {
        id: result.id,
        status: result.status,
        hasOriginalText: !!result.originalText,
        originalTextLength: result.originalText?.length ?? 0,
        hasReconstructedMarkdown: !!result.reconstructedMarkdown,
      });

      // 상태를 analyzing으로 업데이트 (진행 상태 초기화)
      await updateSessionStatus(sessionId, 'analyzing', {
        currentStep: 'reconstruct',
        totalSteps: 4,
        completedSteps: 0,
        processedClaims: 0,
      });

      return result;
    });

    // Step 2: 마크다운 재구성 (없는 경우)
    const markdown = await step.run('reconstruct-markdown', async () => {
      console.log(`[validate-claims:reconstruct-markdown] Starting reconstruction for session: ${sessionId}`);

      // 이미 재구성된 마크다운이 있으면 그대로 사용
      if (session.reconstructedMarkdown) {
        console.log('[validate-claims:reconstruct-markdown] Using existing reconstructed markdown');
        console.log(`[validate-claims:reconstruct-markdown] Existing markdown length: ${session.reconstructedMarkdown.length}`);
        return session.reconstructedMarkdown;
      }

      // 원본 텍스트가 없으면 에러
      if (!session.originalText) {
        console.error('[validate-claims:reconstruct-markdown] No original text found!');
        throw new Error('No original text found in session');
      }

      console.log(`[validate-claims:reconstruct-markdown] Original text length: ${session.originalText.length}`);
      console.log('[validate-claims:reconstruct-markdown] Calling reconstructAndSave...');

      try {
        const result = await reconstructAndSave(sessionId, session.originalText);
        console.log(`[validate-claims:reconstruct-markdown] Reconstruction complete:`, {
          markdownLength: result.markdown.length,
          truncationOccurred: !!result.truncation,
          ...(result.truncation && {
            originalLength: result.truncation.originalLength,
            lostPercentage: result.truncation.lostPercentage,
          }),
        });

        // Truncation 발생 시 경고
        if (result.truncation) {
          console.warn(`[validate-claims:reconstruct-markdown] ⚠️ Document truncated: ${result.truncation.lostPercentage}% lost`);
        }

        return result.markdown;
      } catch (error) {
        console.error('[validate-claims:reconstruct-markdown] Reconstruction failed:', error);
        throw error;
      }
    });

    if (!markdown) {
      throw new Error('Failed to reconstruct markdown');
    }

    // Step 3: Claim 추출
    const extractedClaims = await step.run('extract-claims', async () => {
      // 재구성 완료 → Claim 추출 단계로
      await updateSessionStatus(sessionId, 'extracting_claims', {
        currentStep: 'extract',
        completedSteps: 1,
      });

      const result = await extractClaims(sessionId, markdown);
      console.log(`[validate-claims] Extracted ${result.length} claims`);

      return result;
    });

    if (extractedClaims.length === 0) {
      // Claim이 없으면 바로 ready_for_review로
      await step.run('no-claims-complete', async () => {
        await updateSessionStatus(sessionId, 'ready_for_review', {
          currentStep: 'complete',
          completedSteps: 4,
        }, {
          totalClaims: 0,
          riskScore: 0,
        });
      });

      return {
        sessionId,
        status: 'ready_for_review',
        totalClaims: 0,
        message: 'No claims found in document',
      };
    }

    // Step 4: Regex 검증
    await step.run('verify-with-regex', async () => {
      // Claim 추출 완료 → Regex 검증 단계로
      await updateSessionStatus(sessionId, 'verifying', {
        currentStep: 'regex',
        completedSteps: 2,
      });

      // DB에서 저장된 claim들 조회 (extractClaims에서 저장됨)
      const savedClaims = await db
        .select()
        .from(claims)
        .where(eq(claims.sessionId, sessionId));

      // ClaimToVerify 인터페이스에 맞게 변환 (claimText, claimType 필요)
      const claimsToVerify = savedClaims.map((c) => ({
        id: c.id,
        claimText: c.claimText,
        claimType: c.claimType,
      }));

      await verifyWithRegex(sessionId, claimsToVerify);
      console.log(`[validate-claims] Regex verification completed for ${claimsToVerify.length} claims`);
    });

    // Step 5: LLM 검증 (pending 상태인 claim만)
    await step.run('verify-with-llm', async () => {
      // Regex 검증 완료 → LLM 검증 단계로
      await updateSessionStatus(sessionId, 'verifying', {
        currentStep: 'llm',
        completedSteps: 3,
      });

      // pending 상태인 claim들 조회
      const pendingClaims = await db
        .select()
        .from(claims)
        .where(eq(claims.sessionId, sessionId))
        .then((rows) => rows.filter((c) => c.verdict === 'pending'));

      if (pendingClaims.length === 0) {
        console.log('[validate-claims] No pending claims for LLM verification');
        return;
      }

      // ClaimToVerify 인터페이스에 맞게 변환 (id, claimText 필요)
      const claimsToVerify = pendingClaims.map((c) => ({
        id: c.id,
        claimText: c.claimText,
      }));

      await verifyWithLLM(sessionId, claimsToVerify);
      console.log(`[validate-claims] LLM verification completed for ${claimsToVerify.length} claims`);
    });

    // Step 6: 위험도 점수 계산
    const riskScore = await step.run('calculate-risk-score', async () => {
      const score = await calculateRiskScore(sessionId);
      console.log(`[validate-claims] Risk score: ${score}`);
      return score;
    });

    // Step 7: 세션 상태를 ready_for_review로 업데이트하고 최종 통계 조회
    const finalStats = await step.run('complete-validation', async () => {
      // LLM 검증 완료 → 완료 상태로
      await updateSessionStatus(sessionId, 'ready_for_review', {
        currentStep: 'complete',
        completedSteps: 4,
      });

      // 최종 세션 통계 조회
      const updatedSession = await db
        .select()
        .from(validationSessions)
        .where(eq(validationSessions.id, sessionId))
        .then((rows) => rows[0]);

      console.log(`[validate-claims] Validation complete for session: ${sessionId}`);

      return {
        totalClaims: updatedSession?.totalClaims ?? 0,
        supportedCount: updatedSession?.supportedCount ?? 0,
        contradictedCount: updatedSession?.contradictedCount ?? 0,
        notFoundCount: updatedSession?.notFoundCount ?? 0,
        highRiskCount: updatedSession?.highRiskCount ?? 0,
      };
    });

    return {
      sessionId,
      chatbotId,
      tenantId,
      status: 'ready_for_review',
      riskScore,
      ...finalStats,
    };
  }
);
