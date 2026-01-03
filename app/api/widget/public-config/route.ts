/**
 * 위젯 공개 설정 조회 API
 *
 * GET /api/widget/public-config?key=wgt_xxx
 * - 외부 웹사이트에서 위젯 설정을 조회하기 위한 공개 API
 * - 인증 없이 API 키로만 접근 가능
 * - CORS 허용 (외부 사이트에서 호출)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, tenants, chatbotConfigVersions } from '@/drizzle/schema';
import { DEFAULT_CONFIG, DEFAULT_THEME } from '@/lib/widget/types';

/**
 * CORS 헤더 설정
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24시간 캐시
  };
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

/**
 * GET /api/widget/public-config?key=wgt_xxx
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.nextUrl.searchParams.get('key');

    // API 키 검증
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required', code: 'MISSING_API_KEY' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!apiKey.startsWith('wgt_')) {
      return NextResponse.json(
        { error: 'Invalid API key format', code: 'INVALID_API_KEY' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // 챗봇 조회 (API 키로) - published 버전에서 설정 읽기
    const [result] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        tenantId: chatbots.tenantId,
        widgetEnabled: chatbots.widgetEnabled,
        // chatbots 테이블 값 (폴백용)
        chatbotWidgetConfig: chatbots.widgetConfig,
        // published 버전 값 (우선)
        publishedWidgetConfig: chatbotConfigVersions.widgetConfig,
      })
      .from(chatbots)
      .leftJoin(
        chatbotConfigVersions,
        and(
          eq(chatbotConfigVersions.chatbotId, chatbots.id),
          eq(chatbotConfigVersions.versionType, 'published')
        )
      )
      .where(eq(chatbots.widgetApiKey, apiKey));

    // published 버전이 있으면 사용, 없으면 chatbots 테이블 값으로 폴백
    const chatbot = result
      ? {
          id: result.id,
          name: result.name,
          tenantId: result.tenantId,
          widgetEnabled: result.widgetEnabled,
          widgetConfig: result.publishedWidgetConfig ?? result.chatbotWidgetConfig,
        }
      : null;

    // 챗봇 없음
    if (!chatbot) {
      return NextResponse.json(
        { error: 'Widget not found', code: 'NOT_FOUND' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 위젯 비활성화
    if (!chatbot.widgetEnabled) {
      return NextResponse.json(
        { error: 'Widget is disabled', code: 'DISABLED' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // 테넌트 상태 확인
    const [tenant] = await db
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, chatbot.tenantId));

    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json(
        { error: 'Service unavailable', code: 'INACTIVE_TENANT' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // 위젯 설정 병합 (기본값 + 저장된 설정)
    const savedConfig = (chatbot.widgetConfig as Record<string, unknown>) || {};
    const config = {
      position: savedConfig.position || DEFAULT_CONFIG.position,
      title: savedConfig.title || DEFAULT_CONFIG.title,
      subtitle: savedConfig.subtitle || DEFAULT_CONFIG.subtitle,
      placeholder: savedConfig.placeholder || DEFAULT_CONFIG.placeholder,
      welcomeMessage: savedConfig.welcomeMessage || DEFAULT_CONFIG.welcomeMessage,
      buttonIcon: savedConfig.buttonIcon || DEFAULT_CONFIG.buttonIcon,
      theme: {
        primaryColor:
          (savedConfig.primaryColor as string) ||
          (savedConfig.theme as Record<string, unknown>)?.primaryColor ||
          DEFAULT_THEME.primaryColor,
        backgroundColor:
          (savedConfig.backgroundColor as string) ||
          (savedConfig.theme as Record<string, unknown>)?.backgroundColor ||
          DEFAULT_THEME.backgroundColor,
        textColor:
          (savedConfig.textColor as string) ||
          (savedConfig.theme as Record<string, unknown>)?.textColor ||
          DEFAULT_THEME.textColor,
        fontFamily: DEFAULT_THEME.fontFamily,
        borderRadius:
          (savedConfig.borderRadius as number) ||
          (savedConfig.theme as Record<string, unknown>)?.borderRadius ||
          DEFAULT_THEME.borderRadius,
        buttonSize:
          (savedConfig.buttonSize as number) ||
          (savedConfig.theme as Record<string, unknown>)?.buttonSize ||
          DEFAULT_THEME.buttonSize,
      },
      // 자동 환영 메시지 설정
      autoOpen: savedConfig.autoOpen ?? false,
      autoOpenDelay: (savedConfig.autoOpenDelay as number) || 5000, // 기본 5초
    };

    // 응답
    const response = NextResponse.json(
      {
        tenantId: chatbot.tenantId,
        chatbotId: chatbot.id,
        chatbotName: chatbot.name,
        config,
      },
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          // 설정은 5분간 캐시 (너무 자주 변경되지 않음)
          'Cache-Control': 'public, max-age=300',
        },
      }
    );

    return response;
  } catch (error) {
    console.error('[Widget Public Config] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
