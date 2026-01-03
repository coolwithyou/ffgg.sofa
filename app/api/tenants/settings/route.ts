/**
 * Tenant Settings API
 *
 * GET: 테넌트 티어 및 설정 조회
 * PATCH: 테넌트 설정 업데이트 (advancedDatasetMode 등)
 */

import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { db, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  type TenantSettings,
  DEFAULT_TENANT_SETTINGS,
  canEnableAdvancedMode,
} from '@/lib/tier/types';
import { type Tier } from '@/lib/tier/constants';

/**
 * GET /api/tenants/settings
 *
 * 현재 테넌트의 티어와 설정을 조회합니다.
 */
export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const [tenant] = await db
      .select({
        tier: tenants.tier,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, session.tenantId));

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // settings가 null이면 기본값 사용
    const settings: TenantSettings = tenant.settings
      ? { ...DEFAULT_TENANT_SETTINGS, ...(tenant.settings as TenantSettings) }
      : DEFAULT_TENANT_SETTINGS;

    return NextResponse.json({
      tier: (tenant.tier as Tier) || 'basic',
      settings,
    });
  } catch (error) {
    console.error('Failed to get tenant settings:', error);
    return NextResponse.json(
      { error: '설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenants/settings
 *
 * 테넌트 설정을 업데이트합니다.
 * advancedDatasetMode는 Premium 티어에서만 true로 설정 가능합니다.
 */
export async function PATCH(request: Request) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { advancedDatasetMode } = body;

    // 현재 테넌트 정보 조회
    const [tenant] = await db
      .select({
        tier: tenants.tier,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, session.tenantId));

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const currentTier = (tenant.tier as Tier) || 'basic';
    const currentSettings: TenantSettings = tenant.settings
      ? { ...DEFAULT_TENANT_SETTINGS, ...(tenant.settings as TenantSettings) }
      : DEFAULT_TENANT_SETTINGS;

    // advancedDatasetMode 업데이트 처리
    if (typeof advancedDatasetMode === 'boolean') {
      // Premium이 아닌 경우 true로 설정 불가
      if (advancedDatasetMode && !canEnableAdvancedMode(currentTier)) {
        return NextResponse.json(
          { error: '고급 데이터 관리는 Premium 플랜에서만 사용 가능합니다.' },
          { status: 403 }
        );
      }

      currentSettings.advancedDatasetMode = advancedDatasetMode;
    }

    // 설정 저장
    await db
      .update(tenants)
      .set({
        settings: currentSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, session.tenantId));

    return NextResponse.json({
      success: true,
      tier: currentTier,
      settings: currentSettings,
    });
  } catch (error) {
    console.error('Failed to update tenant settings:', error);
    return NextResponse.json(
      { error: '설정을 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
