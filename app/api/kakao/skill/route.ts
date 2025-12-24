/**
 * 카카오 오픈빌더 스킬 서버
 * [Week 8] 카카오톡 연동
 *
 * POST /api/kakao/skill - 스킬 요청 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processKakaoSkill, createSimpleTextResponse, createErrorResponse, createResponseWithSources } from '@/lib/kakao';
import { validateKakaoIp, checkKakaoRateLimit } from '@/lib/kakao/security';
import { logger } from '@/lib/logger';
import type { KakaoSkillRequest, KakaoSkillResponse } from '@/lib/kakao/types';

// 카카오 스킬 요청 검증 스키마 (필수 필드만)
const kakaoRequestSchema = z.object({
  userRequest: z.object({
    timezone: z.string().optional(),
    utterance: z.string(),
    user: z.object({
      id: z.string(),
      type: z.literal('botUserKey').optional(),
    }),
  }),
  bot: z.object({
    id: z.string(),
    name: z.string().optional(),
  }).optional(),
});

/**
 * POST /api/kakao/skill - 스킬 요청 처리
 */
export async function POST(request: NextRequest): Promise<NextResponse<KakaoSkillResponse>> {
  const startTime = Date.now();

  try {
    // 1. IP 화이트리스트 검증
    const ipValidation = validateKakaoIp(request);
    if (!ipValidation.valid) {
      logger.warn('Kakao skill: IP blocked', { ip: ipValidation.ip, reason: ipValidation.reason });
      return NextResponse.json(createErrorResponse('invalid_request'), { status: 403 });
    }

    // 2. 요청 본문 파싱
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logger.warn('Kakao skill: invalid JSON');
      return NextResponse.json(createErrorResponse('invalid_request'));
    }

    // 3. 스키마 검증
    const parseResult = kakaoRequestSchema.safeParse(body);
    if (!parseResult.success) {
      logger.warn('Kakao skill: validation failed', {
        errors: parseResult.error.issues.map((i) => i.message),
      });
      return NextResponse.json(createErrorResponse('invalid_request'));
    }

    const kakaoRequest = parseResult.data as KakaoSkillRequest;

    // 4. Rate Limiting (botId, userId로)
    const botId = kakaoRequest.bot?.id;
    const userId = kakaoRequest.userRequest.user.id;
    if (botId && userId) {
      const rateLimitResult = await checkKakaoRateLimit(botId, userId);
      if (!rateLimitResult.allowed) {
        logger.warn('Kakao skill: rate limited', {
          botId,
          userId: userId.slice(0, 8) + '...',
        });
        return NextResponse.json(createErrorResponse('internal_error'), {
          status: 429,
          headers: rateLimitResult.retryAfter
            ? { 'Retry-After': rateLimitResult.retryAfter.toString() }
            : undefined,
        });
      }
    }

    // 로깅 (민감 정보 제외)
    logger.info('Kakao skill request', {
      botId: kakaoRequest.bot?.id,
      userId: kakaoRequest.userRequest.user.id.slice(0, 8) + '...',
      utteranceLength: kakaoRequest.userRequest.utterance.length,
    });

    // 스킬 처리
    const result = await processKakaoSkill(kakaoRequest);

    if (!result.success) {
      const response = createErrorResponse(result.errorType || 'internal_error');
      const duration = Date.now() - startTime;
      logger.info('Kakao skill error response', { errorType: result.errorType, duration });
      return NextResponse.json(response);
    }

    // 성공 응답 생성
    let response: KakaoSkillResponse;

    if (result.sources && result.sources.length > 0) {
      response = createResponseWithSources(result.message, result.sources);
    } else {
      response = createSimpleTextResponse(result.message);
    }

    const duration = Date.now() - startTime;
    logger.info('Kakao skill success response', {
      duration,
      responseLength: result.message.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Kakao skill unexpected error', error as Error, { duration });
    return NextResponse.json(createErrorResponse('internal_error'));
  }
}

/**
 * GET /api/kakao/skill - 헬스체크 (카카오 오픈빌더 연동 확인용)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'SOFA Kakao Skill Server',
    timestamp: new Date().toISOString(),
  });
}
