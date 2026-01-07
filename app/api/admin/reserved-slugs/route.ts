/**
 * 관리자 예약 슬러그 API
 * 슬러그 블랙리스트 관리 (CRUD)
 *
 * GET /api/admin/reserved-slugs - 예약 슬러그 목록 조회
 * POST /api/admin/reserved-slugs - 예약 슬러그 추가
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc, ilike, and, count, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservedSlugs, users } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { isSystemReservedSlug } from '@/lib/public-page/reserved-slugs';
import { logger } from '@/lib/logger';

// 카테고리 타입
const CATEGORIES = ['profanity', 'brand', 'premium', 'system', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

// 추가 스키마
const createSchema = z.object({
  slug: z
    .string()
    .min(1, '슬러그를 입력해주세요')
    .max(50, '슬러그는 최대 50자까지 가능합니다')
    .transform((s) => s.toLowerCase().trim()),
  category: z.enum(CATEGORIES, {
    message: '유효한 카테고리를 선택해주세요',
  }),
  reason: z.string().max(200, '사유는 최대 200자까지 가능합니다').optional(),
});

// 일괄 추가 스키마
const bulkCreateSchema = z.object({
  slugs: z
    .array(
      z.object({
        slug: z.string().min(1).max(50).transform((s) => s.toLowerCase().trim()),
        category: z.enum(CATEGORIES),
        reason: z.string().max(200).optional(),
      })
    )
    .min(1, '최소 1개 이상의 슬러그가 필요합니다')
    .max(100, '한 번에 최대 100개까지 추가할 수 있습니다'),
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
 * GET /api/admin/reserved-slugs
 * 예약 슬러그 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAdminAccess();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') as Category | null;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
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

    // 목록 조회 (생성자 정보 포함)
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

    // 전체 개수 조회
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

    return NextResponse.json({
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
    });
  } catch (error) {
    logger.error('Admin reserved slugs GET error', error as Error);
    return NextResponse.json(
      { error: '목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reserved-slugs
 * 예약 슬러그 추가 (단일 또는 일괄)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAdminAccess();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await request.json();

    // 일괄 추가인지 단일 추가인지 구분
    const isBulk = 'slugs' in body && Array.isArray(body.slugs);

    if (isBulk) {
      // 일괄 추가
      const parseResult = bulkCreateSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.error.issues[0]?.message || '잘못된 요청입니다' },
          { status: 400 }
        );
      }

      const { slugs: slugsToAdd } = parseResult.data;

      // 시스템 예약어와 중복 검사
      const results = {
        added: [] as string[],
        skipped: [] as { slug: string; reason: string }[],
      };

      for (const item of slugsToAdd) {
        // 시스템 예약어 확인
        if (isSystemReservedSlug(item.slug)) {
          results.skipped.push({
            slug: item.slug,
            reason: '시스템 예약어입니다',
          });
          continue;
        }

        // DB 중복 확인
        const existing = await db
          .select({ id: reservedSlugs.id })
          .from(reservedSlugs)
          .where(eq(reservedSlugs.slug, item.slug))
          .limit(1);

        if (existing.length > 0) {
          results.skipped.push({
            slug: item.slug,
            reason: '이미 등록된 슬러그입니다',
          });
          continue;
        }

        // 추가
        await db.insert(reservedSlugs).values({
          slug: item.slug,
          category: item.category,
          reason: item.reason,
          createdBy: userId,
        });

        results.added.push(item.slug);
      }

      return NextResponse.json({
        message: `${results.added.length}개 추가됨, ${results.skipped.length}개 건너뜀`,
        results,
      });
    } else {
      // 단일 추가
      const parseResult = createSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.error.issues[0]?.message || '잘못된 요청입니다' },
          { status: 400 }
        );
      }

      const { slug, category, reason } = parseResult.data;

      // 시스템 예약어 확인
      if (isSystemReservedSlug(slug)) {
        return NextResponse.json(
          { error: '시스템 예약어는 추가할 수 없습니다' },
          { status: 400 }
        );
      }

      // DB 중복 확인
      const existing = await db
        .select({ id: reservedSlugs.id })
        .from(reservedSlugs)
        .where(eq(reservedSlugs.slug, slug))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: '이미 등록된 슬러그입니다' },
          { status: 400 }
        );
      }

      // 추가
      const [newSlug] = await db
        .insert(reservedSlugs)
        .values({
          slug,
          category,
          reason,
          createdBy: userId,
        })
        .returning();

      return NextResponse.json({
        message: '예약 슬러그가 추가되었습니다',
        slug: newSlug,
      });
    }
  } catch (error) {
    logger.error('Admin reserved slugs POST error', error as Error);
    return NextResponse.json(
      { error: '추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
