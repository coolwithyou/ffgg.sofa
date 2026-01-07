/**
 * 카카오 오픈빌더 서비스
 * [Week 8] 카카오톡 연동
 */

import { db, tenants } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { eq, sql, and } from 'drizzle-orm';
import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';
import { validatePointsForResponse, usePoints } from '@/lib/points';
import type { KakaoSkillRequest, TenantKakaoSettings } from './types';

// 카카오 5초 제한 대비 4초 타임아웃
const KAKAO_TIMEOUT_MS = 4000;

// 기본 응답 최대 길이
const DEFAULT_MAX_RESPONSE_LENGTH = 300;

/**
 * 타임아웃 에러
 */
class TimeoutError extends Error {
  constructor() {
    super('Request timeout');
    this.name = 'TimeoutError';
  }
}

/**
 * 봇 ID로 챗봇 및 테넌트 조회
 * 새로운 chatbots 테이블에서 먼저 조회하고, 없으면 레거시 tenants.settings에서 조회
 */
export async function getTenantByKakaoBot(
  botId: string
): Promise<{ id: string; chatbotId?: string; settings: TenantKakaoSettings } | null> {
  try {
    // 1. 먼저 chatbots 테이블에서 조회
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        tenantId: chatbots.tenantId,
        kakaoConfig: chatbots.kakaoConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.kakaoBotId, botId), eq(chatbots.kakaoEnabled, true)));

    if (chatbot) {
      const kakaoConfig = chatbot.kakaoConfig as Record<string, unknown> || {};
      const kakaoSettings: TenantKakaoSettings = {
        botId,
        skillUrl: kakaoConfig.skillUrl as string | undefined,
        maxResponseLength: (kakaoConfig.maxResponseLength as number) || DEFAULT_MAX_RESPONSE_LENGTH,
        welcomeMessage: kakaoConfig.welcomeMessage as string | undefined,
      };

      return {
        id: chatbot.tenantId,
        chatbotId: chatbot.id,
        settings: kakaoSettings,
      };
    }

    // 2. 레거시: tenants.settings에서 조회 (하위 호환성)
    const result = await db.query.tenants.findFirst({
      where: sql`${tenants.settings}->>'kakaoBotId' = ${botId} AND ${tenants.status} = 'active'`,
      columns: {
        id: true,
        settings: true,
      },
    });

    if (!result) {
      return null;
    }

    const settings = result.settings as Record<string, unknown>;
    const kakaoSettings: TenantKakaoSettings = {
      botId: (settings.kakaoBotId as string) || botId,
      skillUrl: settings.kakaoSkillUrl as string | undefined,
      maxResponseLength: (settings.kakaoMaxResponseLength as number) || DEFAULT_MAX_RESPONSE_LENGTH,
      welcomeMessage: settings.kakaoWelcomeMessage as string | undefined,
    };

    return {
      id: result.id,
      settings: kakaoSettings,
    };
  } catch (error) {
    logger.error('Failed to get tenant by kakao bot', error as Error, { botId });
    return null;
  }
}

/**
 * 타임아웃과 함께 Promise 실행
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new TimeoutError()), timeoutMs);
    }),
  ]);
}

/**
 * 카카오 스킬 요청 처리
 */
export async function processKakaoSkill(
  request: KakaoSkillRequest
): Promise<{
  success: boolean;
  message: string;
  sources?: Array<{ title: string; documentId: string }>;
  errorType?: 'timeout' | 'not_found' | 'invalid_request' | 'internal_error' | 'insufficient_points';
}> {
  const startTime = Date.now();

  try {
    // 봇 ID 추출
    const botId = request.bot?.id;
    if (!botId) {
      logger.warn('Kakao skill request without bot ID');
      return { success: false, message: '', errorType: 'invalid_request' };
    }

    // 사용자 발화 추출
    const utterance = request.userRequest.utterance?.trim();
    if (!utterance) {
      logger.warn('Kakao skill request without utterance', { botId });
      return { success: false, message: '', errorType: 'invalid_request' };
    }

    // 테넌트 조회
    const tenant = await getTenantByKakaoBot(botId);
    if (!tenant) {
      logger.warn('Kakao bot not found', { botId });
      return { success: false, message: '', errorType: 'not_found' };
    }

    // 포인트 검증
    const pointValidation = await validatePointsForResponse(tenant.id);
    if (!pointValidation.canProceed) {
      logger.warn('Kakao skill: insufficient points', {
        botId,
        tenantId: tenant.id,
        currentBalance: pointValidation.currentBalance,
      });
      return { success: false, message: '', errorType: 'insufficient_points' };
    }

    // 사용자 ID (카카오 봇 유저키)
    const userId = request.userRequest.user.id;

    // RAG 처리 (타임아웃 적용)
    const response = await withTimeout(
      processChat(tenant.id, {
        message: utterance,
        sessionId: `kakao-${userId}`,
        channel: 'kakao',
        chatbotId: tenant.chatbotId,
      }),
      KAKAO_TIMEOUT_MS
    );

    // 포인트 차감 (AI 응답 성공 후)
    await usePoints({
      tenantId: tenant.id,
      metadata: {
        chatbotId: tenant.chatbotId,
        conversationId: response.sessionId,
        channel: 'kakao',
      },
    });

    const duration = Date.now() - startTime;
    logger.info('Kakao skill processed', {
      botId,
      tenantId: tenant.id,
      utteranceLength: utterance.length,
      responseLength: response.message.length,
      duration,
    });

    // 응답 길이 제한
    let message = response.message;
    const maxLength = tenant.settings.maxResponseLength || DEFAULT_MAX_RESPONSE_LENGTH;
    if (message.length > maxLength) {
      message = message.slice(0, maxLength - 3) + '...';
    }

    // sources 변환 (content 첫 50자를 title로 사용)
    const transformedSources = response.sources?.map((s) => ({
      title: s.content.slice(0, 50) + (s.content.length > 50 ? '...' : ''),
      documentId: s.documentId,
    }));

    return {
      success: true,
      message,
      sources: transformedSources,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof TimeoutError) {
      logger.warn('Kakao skill timeout', { duration });
      return { success: false, message: '', errorType: 'timeout' };
    }

    logger.error('Kakao skill processing failed', error as Error, { duration });
    return { success: false, message: '', errorType: 'internal_error' };
  }
}

/**
 * 테넌트 카카오 설정 업데이트
 */
export async function updateTenantKakaoSettings(
  tenantId: string,
  settings: Partial<TenantKakaoSettings>
): Promise<boolean> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { settings: true },
    });

    if (!tenant) {
      return false;
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {};

    const updatedSettings = {
      ...currentSettings,
      ...(settings.botId && { kakaoBotId: settings.botId }),
      ...(settings.skillUrl !== undefined && { kakaoSkillUrl: settings.skillUrl }),
      ...(settings.maxResponseLength !== undefined && { kakaoMaxResponseLength: settings.maxResponseLength }),
      ...(settings.welcomeMessage !== undefined && { kakaoWelcomeMessage: settings.welcomeMessage }),
    };

    await db
      .update(tenants)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    logger.info('Tenant kakao settings updated', { tenantId, updates: Object.keys(settings) });

    return true;
  } catch (error) {
    logger.error('Failed to update tenant kakao settings', error as Error, { tenantId });
    return false;
  }
}

/**
 * 카카오 스킬 URL 생성
 */
export function generateSkillUrl(baseUrl: string): string {
  return `${baseUrl}/api/kakao/skill`;
}
