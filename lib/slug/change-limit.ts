/**
 * 슬러그 변경 제한 관련 유틸리티
 *
 * 티어별 슬러그 변경 횟수 제한을 관리합니다.
 * - free: 변경 불가 (발행 불가이므로)
 * - pro: 챗봇별 하루 3회
 * - business: 무제한
 */

import { db } from '@/lib/db';
import { slugChangeLogs } from '@/drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { TIER_LIMITS, type Tier } from '@/lib/tier/constants';

export interface SlugChangeLimitInfo {
  canChange: boolean;
  remaining: number; // -1은 무제한
  limit: number; // -1은 무제한
  reason?: string; // 변경 불가 시 이유
}

/**
 * 오늘 슬러그 변경 횟수 조회 (UTC 기준)
 */
export async function getSlugChangesToday(chatbotId: string): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(slugChangeLogs)
    .where(
      and(
        eq(slugChangeLogs.chatbotId, chatbotId),
        gte(slugChangeLogs.changedAt, today)
      )
    );

  return result[0]?.count || 0;
}

/**
 * 슬러그 변경 가능 여부 확인
 */
export async function checkSlugChangeLimit(
  chatbotId: string,
  tier: Tier
): Promise<SlugChangeLimitInfo> {
  const limit = TIER_LIMITS[tier].slugChangesPerDay;

  // 무제한인 경우 (business)
  if (limit === -1) {
    return {
      canChange: true,
      remaining: -1,
      limit: -1,
    };
  }

  // 변경 불가인 경우 (free)
  if (limit === 0) {
    return {
      canChange: false,
      remaining: 0,
      limit: 0,
      reason: 'Pro 플랜으로 업그레이드하면 슬러그를 변경할 수 있습니다',
    };
  }

  // 제한이 있는 경우 (pro)
  const usedToday = await getSlugChangesToday(chatbotId);
  const remaining = Math.max(0, limit - usedToday);

  return {
    canChange: remaining > 0,
    remaining,
    limit,
    reason: remaining === 0 ? '오늘 변경 횟수를 모두 사용했습니다' : undefined,
  };
}

/**
 * 슬러그 변경 이력 기록
 */
export async function logSlugChange(params: {
  chatbotId: string;
  previousSlug: string | null;
  newSlug: string;
  changedBy: string;
}): Promise<void> {
  await db.insert(slugChangeLogs).values({
    chatbotId: params.chatbotId,
    previousSlug: params.previousSlug,
    newSlug: params.newSlug,
    changedBy: params.changedBy,
  });
}
