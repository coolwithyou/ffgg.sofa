'use server';

/**
 * 설정 서버 액션
 * [Week 9] 테넌트 설정 관리
 */

import { validateSession } from '@/lib/auth';
import { db, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export interface TenantSettings {
  // 카카오 연동
  kakaoBotId?: string;
  kakaoMaxResponseLength?: number;
  kakaoWelcomeMessage?: string;
  // 위젯 설정
  widgetPrimaryColor?: string;
  widgetTitle?: string;
  widgetSubtitle?: string;
  widgetPlaceholder?: string;
}

/**
 * 테넌트 설정 조회
 */
export async function getTenantSettings(): Promise<TenantSettings | null> {
  const session = await validateSession();

  if (!session) {
    return null;
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, session.tenantId),
      columns: { settings: true },
    });

    if (!tenant) {
      return null;
    }

    const settings = (tenant.settings as Record<string, unknown>) || {};

    return {
      kakaoBotId: settings.kakaoBotId as string | undefined,
      kakaoMaxResponseLength: settings.kakaoMaxResponseLength as number | undefined,
      kakaoWelcomeMessage: settings.kakaoWelcomeMessage as string | undefined,
      widgetPrimaryColor: settings.widgetPrimaryColor as string | undefined,
      widgetTitle: settings.widgetTitle as string | undefined,
      widgetSubtitle: settings.widgetSubtitle as string | undefined,
      widgetPlaceholder: settings.widgetPlaceholder as string | undefined,
    };
  } catch (error) {
    logger.error('Failed to get tenant settings', error as Error, {
      tenantId: session.tenantId,
    });
    return null;
  }
}

/**
 * 카카오 설정 업데이트
 */
export async function updateKakaoSettings(data: {
  botId: string;
  maxResponseLength: number;
  welcomeMessage: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, session.tenantId),
      columns: { settings: true },
    });

    if (!tenant) {
      return { success: false, error: '테넌트를 찾을 수 없습니다.' };
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {};

    await db
      .update(tenants)
      .set({
        settings: {
          ...currentSettings,
          kakaoBotId: data.botId || null,
          kakaoMaxResponseLength: data.maxResponseLength || 300,
          kakaoWelcomeMessage: data.welcomeMessage || null,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, session.tenantId));

    revalidatePath('/settings');

    logger.info('Kakao settings updated', { tenantId: session.tenantId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to update kakao settings', error as Error, {
      tenantId: session.tenantId,
    });
    return { success: false, error: '설정 저장에 실패했습니다.' };
  }
}

/**
 * 위젯 설정 업데이트
 */
export async function updateWidgetSettings(data: {
  primaryColor: string;
  title: string;
  subtitle: string;
  placeholder: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, session.tenantId),
      columns: { settings: true },
    });

    if (!tenant) {
      return { success: false, error: '테넌트를 찾을 수 없습니다.' };
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {};

    await db
      .update(tenants)
      .set({
        settings: {
          ...currentSettings,
          widgetPrimaryColor: data.primaryColor,
          widgetTitle: data.title,
          widgetSubtitle: data.subtitle,
          widgetPlaceholder: data.placeholder,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, session.tenantId));

    revalidatePath('/settings');

    logger.info('Widget settings updated', { tenantId: session.tenantId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to update widget settings', error as Error, {
      tenantId: session.tenantId,
    });
    return { success: false, error: '설정 저장에 실패했습니다.' };
  }
}

/**
 * 위젯 임베드 코드 생성
 */
export async function getWidgetEmbedCode(): Promise<string | null> {
  const session = await validateSession();

  if (!session) {
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com';

  return `<!-- RAG 챗봇 위젯 -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/widget/chatbot.js';
    script.async = true;
    script.dataset.tenantId = '${session.tenantId}';
    document.head.appendChild(script);
  })();
</script>`;
}
