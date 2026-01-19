// lib/knowledge-pages/verification/llm-verifier.ts

import { db } from '@/lib/db';
import { claims, sourceSpans, validationSessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  VERIFICATION_SYSTEM_PROMPT,
  createVerificationPrompt,
} from './prompts/verification';
import type { Verdict, SuspicionType } from '../types';

// NOTE: Claim 검증은 추론 정확도가 중요하므로 Claude Haiku 유지
// (Gemini는 구조화된 출력에 적합, Claude는 추론에 적합)
const anthropic = createAnthropic();

interface VerificationResult {
  claimId: string;
  verdict: Verdict;
  confidence: number;
  suspicionType?: SuspicionType;
  sourceSpan?: {
    text: string;
    startChar: number;
    endChar: number;
  };
  explanation: string;
}

interface ClaimToVerify {
  id: string;
  claimText: string;
}

/**
 * LLM 기반 검증 (Level 2)
 *
 * Regex로 검증되지 않은 Claim을 LLM으로 검증합니다.
 * 원문과 Claim을 비교하여 SUPPORTED/CONTRADICTED/NOT_FOUND 판정.
 */
export async function verifyWithLLM(
  sessionId: string,
  claimsToVerify: ClaimToVerify[]
): Promise<void> {
  if (claimsToVerify.length === 0) return;

  const session = await db.query.validationSessions.findFirst({
    where: eq(validationSessions.id, sessionId),
  });
  if (!session) throw new Error('Session not found');

  // 배치 처리 (한 번에 최대 20개)
  const batchSize = 20;
  for (let i = 0; i < claimsToVerify.length; i += batchSize) {
    const batch = claimsToVerify.slice(i, i + batchSize);

    // LLM 호출
    const { text } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      system: VERIFICATION_SYSTEM_PROMPT,
      prompt: createVerificationPrompt(
        session.originalText,
        batch.map((c) => ({ id: c.id, text: c.claimText }))
      ),
      maxOutputTokens: 4096,
      temperature: 0,
    });

    // 결과 파싱
    const results = parseVerificationResults(text, batch);

    // DB 업데이트
    for (const result of results) {
      await db
        .update(claims)
        .set({
          verdict: result.verdict,
          verificationLevel: 'llm',
          confidence: result.confidence,
          verificationDetail: result.explanation,
          suspicionType: result.suspicionType,
        })
        .where(eq(claims.id, result.claimId));

      if (result.sourceSpan) {
        // 실제 위치 찾기
        const actualStart = session.originalText.indexOf(result.sourceSpan.text);
        const actualEnd =
          actualStart !== -1
            ? actualStart + result.sourceSpan.text.length
            : result.sourceSpan.endChar;

        await db.insert(sourceSpans).values({
          claimId: result.claimId,
          sourceText: result.sourceSpan.text,
          startChar: actualStart !== -1 ? actualStart : result.sourceSpan.startChar,
          endChar: actualEnd,
          matchScore: result.confidence,
          matchMethod: 'semantic',
        });
      }
    }
  }
}

/**
 * LLM 응답에서 JSON 배열 추출
 * LLM이 JSON 앞뒤에 텍스트를 추가하는 경우에도 배열을 추출합니다.
 */
function extractJsonArray(text: string): string | null {
  // 1. 마크다운 코드 블록 제거
  let cleaned = text.replace(/```(?:json)?\n?|\n?```/g, '').trim();

  // 2. 이미 '[' 로 시작하면 그대로 반환
  if (cleaned.startsWith('[')) {
    return cleaned;
  }

  // 3. 텍스트 내에서 JSON 배열 찾기 (첫 번째 '[' ~ 마지막 ']')
  const startIdx = cleaned.indexOf('[');
  const endIdx = cleaned.lastIndexOf(']');

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleaned.slice(startIdx, endIdx + 1);
  }

  return null;
}

/**
 * LLM 응답 파싱
 */
function parseVerificationResults(
  llmResponse: string,
  originalClaims: ClaimToVerify[]
): VerificationResult[] {
  try {
    // JSON 배열 추출 시도
    const jsonStr = extractJsonArray(llmResponse);

    if (!jsonStr) {
      console.error(
        'Failed to extract JSON array from LLM response:',
        llmResponse.slice(0, 200)
      );
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonStr) as Array<{
      claimId: string;
      verdict: string;
      confidence: number;
      suspicionType?: string;
      sourceSpan?: { text: string; startChar: number; endChar: number };
      explanation: string;
    }>;

    return parsed.map((item) => ({
      claimId: item.claimId,
      verdict: item.verdict.toLowerCase() as Verdict,
      confidence: item.confidence,
      suspicionType: item.suspicionType?.toLowerCase() as SuspicionType | undefined,
      sourceSpan: item.sourceSpan,
      explanation: item.explanation,
    }));
  } catch (error) {
    console.error('Failed to parse LLM verification results:', error);
    console.error('Raw response (first 500 chars):', llmResponse.slice(0, 500));

    // 파싱 실패 시 모든 Claim을 NOT_FOUND로 처리
    return originalClaims.map((claim) => ({
      claimId: claim.id,
      verdict: 'not_found' as const,
      confidence: 0.5,
      explanation: 'LLM 검증 결과 파싱 실패',
    }));
  }
}
