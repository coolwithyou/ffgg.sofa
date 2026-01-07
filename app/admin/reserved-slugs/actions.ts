'use server';

/**
 * 예약 슬러그 서버 액션
 */

import { eq, desc, ilike, and, count, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservedSlugs, users } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { isSystemReservedSlug } from '@/lib/public-page/reserved-slugs';
import { revalidatePath } from 'next/cache';
import { CATEGORIES, type Category, type ReservedSlugItem } from './constants';

interface GetReservedSlugsParams {
  search?: string;
  category?: Category;
  page?: number;
  pageSize?: number;
}

interface GetReservedSlugsResult {
  slugs: ReservedSlugItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: {
    byCategory: Record<string, number>;
    total: number;
  };
}

/**
 * 관리자 권한 확인
 */
async function checkAdminAccess(): Promise<string | null> {
  const session = await validateSession();
  if (!session) return null;

  if (session.role !== 'internal_operator' && session.role !== 'admin') {
    return null;
  }

  return session.userId;
}

/**
 * 예약 슬러그 목록 조회
 */
export async function getReservedSlugs(
  params: GetReservedSlugsParams = {}
): Promise<GetReservedSlugsResult> {
  const { search = '', category, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  // 필터 조건 구성
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(reservedSlugs.slug, `%${search}%`),
        ilike(reservedSlugs.reason, `%${search}%`)
      )
    );
  }
  if (category && CATEGORIES.includes(category)) {
    conditions.push(eq(reservedSlugs.category, category));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 목록 조회
  const slugs = await db
    .select({
      id: reservedSlugs.id,
      slug: reservedSlugs.slug,
      category: reservedSlugs.category,
      reason: reservedSlugs.reason,
      createdAt: reservedSlugs.createdAt,
      createdByName: users.name,
      createdByEmail: users.email,
    })
    .from(reservedSlugs)
    .leftJoin(users, eq(reservedSlugs.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(reservedSlugs.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 전체 개수
  const [totalResult] = await db
    .select({ count: count() })
    .from(reservedSlugs)
    .where(whereClause);

  // 카테고리별 통계
  const stats = await db
    .select({
      category: reservedSlugs.category,
      count: count(),
    })
    .from(reservedSlugs)
    .groupBy(reservedSlugs.category);

  const categoryStats: Record<string, number> = {};
  for (const stat of stats) {
    categoryStats[stat.category] = stat.count;
  }

  return {
    slugs,
    pagination: {
      page,
      pageSize,
      total: totalResult?.count || 0,
      totalPages: Math.ceil((totalResult?.count || 0) / pageSize),
    },
    stats: {
      byCategory: categoryStats,
      total: totalResult?.count || 0,
    },
  };
}

/**
 * 예약 슬러그 추가
 */
export async function addReservedSlug(data: {
  slug: string;
  category: Category;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const userId = await checkAdminAccess();
  if (!userId) {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }

  const slug = data.slug.toLowerCase().trim();

  // 유효성 검사
  if (!slug) {
    return { success: false, error: '슬러그를 입력해주세요' };
  }

  if (slug.length > 50) {
    return { success: false, error: '슬러그는 최대 50자까지 가능합니다' };
  }

  // 시스템 예약어 확인
  if (isSystemReservedSlug(slug)) {
    return { success: false, error: '시스템 예약어는 추가할 수 없습니다' };
  }

  // 중복 확인
  const existing = await db
    .select({ id: reservedSlugs.id })
    .from(reservedSlugs)
    .where(eq(reservedSlugs.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: '이미 등록된 슬러그입니다' };
  }

  // 추가
  await db.insert(reservedSlugs).values({
    slug,
    category: data.category,
    reason: data.reason,
    createdBy: userId,
  });

  revalidatePath('/admin/reserved-slugs');
  return { success: true };
}

/**
 * 예약 슬러그 일괄 추가
 */
export async function addReservedSlugsBulk(data: {
  slugs: string;
  category: Category;
  reason?: string;
}): Promise<{
  success: boolean;
  added: number;
  skipped: number;
  errors: string[];
}> {
  const userId = await checkAdminAccess();
  if (!userId) {
    return { success: false, added: 0, skipped: 0, errors: ['관리자 권한이 필요합니다'] };
  }

  // 줄바꿈 또는 쉼표로 분리
  const slugList = data.slugs
    .split(/[\n,]/)
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 0);

  if (slugList.length === 0) {
    return { success: false, added: 0, skipped: 0, errors: ['슬러그를 입력해주세요'] };
  }

  if (slugList.length > 100) {
    return { success: false, added: 0, skipped: 0, errors: ['한 번에 최대 100개까지 추가할 수 있습니다'] };
  }

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const slug of slugList) {
    if (slug.length > 50) {
      errors.push(`${slug}: 50자 초과`);
      skipped++;
      continue;
    }

    if (isSystemReservedSlug(slug)) {
      errors.push(`${slug}: 시스템 예약어`);
      skipped++;
      continue;
    }

    const existing = await db
      .select({ id: reservedSlugs.id })
      .from(reservedSlugs)
      .where(eq(reservedSlugs.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(reservedSlugs).values({
      slug,
      category: data.category,
      reason: data.reason,
      createdBy: userId,
    });

    added++;
  }

  revalidatePath('/admin/reserved-slugs');
  return { success: added > 0, added, skipped, errors };
}

/**
 * 예약 슬러그 수정
 */
export async function updateReservedSlug(
  id: string,
  data: {
    slug?: string;
    category?: Category;
    reason?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const userId = await checkAdminAccess();
  if (!userId) {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }

  // 기존 확인
  const [existing] = await db
    .select()
    .from(reservedSlugs)
    .where(eq(reservedSlugs.id, id))
    .limit(1);

  if (!existing) {
    return { success: false, error: '예약 슬러그를 찾을 수 없습니다' };
  }

  // 슬러그 변경 시 검증
  if (data.slug && data.slug !== existing.slug) {
    const newSlug = data.slug.toLowerCase().trim();

    if (isSystemReservedSlug(newSlug)) {
      return { success: false, error: '시스템 예약어는 사용할 수 없습니다' };
    }

    const duplicate = await db
      .select({ id: reservedSlugs.id })
      .from(reservedSlugs)
      .where(eq(reservedSlugs.slug, newSlug))
      .limit(1);

    if (duplicate.length > 0) {
      return { success: false, error: '이미 등록된 슬러그입니다' };
    }
  }

  // 업데이트
  const updateData: Partial<typeof reservedSlugs.$inferInsert> = {};
  if (data.slug !== undefined) updateData.slug = data.slug.toLowerCase().trim();
  if (data.category !== undefined) updateData.category = data.category;
  if (data.reason !== undefined) updateData.reason = data.reason;

  await db.update(reservedSlugs).set(updateData).where(eq(reservedSlugs.id, id));

  revalidatePath('/admin/reserved-slugs');
  return { success: true };
}

/**
 * 예약 슬러그 삭제
 */
export async function deleteReservedSlug(id: string): Promise<{ success: boolean; error?: string }> {
  const userId = await checkAdminAccess();
  if (!userId) {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }

  const [existing] = await db
    .select()
    .from(reservedSlugs)
    .where(eq(reservedSlugs.id, id))
    .limit(1);

  if (!existing) {
    return { success: false, error: '예약 슬러그를 찾을 수 없습니다' };
  }

  await db.delete(reservedSlugs).where(eq(reservedSlugs.id, id));

  revalidatePath('/admin/reserved-slugs');
  return { success: true };
}

/**
 * 예약 슬러그 일괄 삭제
 */
export async function deleteReservedSlugsBulk(ids: string[]): Promise<{
  success: boolean;
  deleted: number;
  error?: string;
}> {
  const userId = await checkAdminAccess();
  if (!userId) {
    return { success: false, deleted: 0, error: '관리자 권한이 필요합니다' };
  }

  if (ids.length === 0) {
    return { success: false, deleted: 0, error: '삭제할 항목을 선택해주세요' };
  }

  let deleted = 0;
  for (const id of ids) {
    await db.delete(reservedSlugs).where(eq(reservedSlugs.id, id));
    deleted++;
  }

  revalidatePath('/admin/reserved-slugs');
  return { success: true, deleted };
}
