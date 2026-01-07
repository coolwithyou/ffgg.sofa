/**
 * 관리자 예약 슬러그 개별 API
 *
 * GET /api/admin/reserved-slugs/:id - 예약 슬러그 상세 조회
 * PATCH /api/admin/reserved-slugs/:id - 예약 슬러그 수정
 * DELETE /api/admin/reserved-slugs/:id - 예약 슬러그 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservedSlugs, users } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { isSystemReservedSlug } from '@/lib/public-page/reserved-slugs';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 카테고리 타입
const CATEGORIES = ['profanity', 'brand', 'premium', 'system', 'other'] as const;

// 수정 스키마
const updateSchema = z.object({
  slug: z
    .string()
    .min(1, '슬러그를 입력해주세요')
    .max(50, '슬러그는 최대 50자까지 가능합니다')
    .transform((s) => s.toLowerCase().trim())
    .optional(),
  category: z
    .enum(CATEGORIES, {
      message: '유효한 카테고리를 선택해주세요',
    })
    .optional(),
  reason: z
    .string()
    .max(200, '사유는 최대 200자까지 가능합니다')
    .nullable()
    .optional(),
});

/**
 * 관리자 권한 확인
 */
async function checkAdminAccess(): Promise<{ userId: string } | NextResponse> {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  // 관리자 권한 확인 (internal_operator 또는 admin)
  if (session.role !== 'internal_operator' && session.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }

  return { userId: session.userId };
}

/**
 * GET /api/admin/reserved-slugs/:id
 * 예약 슬러그 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await checkAdminAccess();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const [slug] = await db
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
      .where(eq(reservedSlugs.id, id))
      .limit(1);

    if (!slug) {
      return NextResponse.json(
        { error: '예약 슬러그를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({ slug });
  } catch (error) {
    logger.error('Admin reserved slug GET error', error as Error);
    return NextResponse.json(
      { error: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/reserved-slugs/:id
 * 예약 슬러그 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await checkAdminAccess();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // 기존 슬러그 확인
    const [existing] = await db
      .select()
      .from(reservedSlugs)
      .where(eq(reservedSlugs.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: '예약 슬러그를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 파싱
    const body = await request.json();
    const parseResult = updateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || '잘못된 요청입니다' },
        { status: 400 }
      );
    }

    const { slug, category, reason } = parseResult.data;

    // 슬러그 변경 시 검증
    if (slug && slug !== existing.slug) {
      // 시스템 예약어 확인
      if (isSystemReservedSlug(slug)) {
        return NextResponse.json(
          { error: '시스템 예약어는 사용할 수 없습니다' },
          { status: 400 }
        );
      }

      // 중복 확인
      const duplicate = await db
        .select({ id: reservedSlugs.id })
        .from(reservedSlugs)
        .where(eq(reservedSlugs.slug, slug))
        .limit(1);

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: '이미 등록된 슬러그입니다' },
          { status: 400 }
        );
      }
    }

    // 업데이트
    const updateData: Partial<typeof reservedSlugs.$inferInsert> = {};
    if (slug !== undefined) updateData.slug = slug;
    if (category !== undefined) updateData.category = category;
    if (reason !== undefined) updateData.reason = reason;

    const [updated] = await db
      .update(reservedSlugs)
      .set(updateData)
      .where(eq(reservedSlugs.id, id))
      .returning();

    return NextResponse.json({
      message: '예약 슬러그가 수정되었습니다',
      slug: updated,
    });
  } catch (error) {
    logger.error('Admin reserved slug PATCH error', error as Error);
    return NextResponse.json(
      { error: '수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reserved-slugs/:id
 * 예약 슬러그 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await checkAdminAccess();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // 기존 슬러그 확인
    const [existing] = await db
      .select()
      .from(reservedSlugs)
      .where(eq(reservedSlugs.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: '예약 슬러그를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 삭제
    await db.delete(reservedSlugs).where(eq(reservedSlugs.id, id));

    return NextResponse.json({
      message: '예약 슬러그가 삭제되었습니다',
      deletedSlug: existing.slug,
    });
  } catch (error) {
    logger.error('Admin reserved slug DELETE error', error as Error);
    return NextResponse.json(
      { error: '삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
