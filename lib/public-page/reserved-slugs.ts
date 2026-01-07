/**
 * 공개 페이지 슬러그 예약어 및 유효성 검사
 *
 * 슬러그는 공개 페이지 URL에서 사용되는 고유 식별자입니다.
 * 시스템 라우트와 충돌을 방지하기 위해 특정 슬러그는 예약되어 있습니다.
 *
 * 예약어 검증은 두 가지 레벨로 동작합니다:
 * 1. 하드코딩된 시스템 예약어 (SYSTEM_RESERVED_SLUGS) - 동기 검사
 * 2. DB에서 관리되는 예약어 (reserved_slugs 테이블) - 비동기 검사
 */

import { db } from '@/lib/db';
import { reservedSlugs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * 시스템 예약어 목록 (하드코딩)
 * 시스템 라우트, 공개 페이지, 일반 예약어를 포함
 * 이 목록은 변경되지 않으며, 관리자가 수정할 수 없습니다.
 */
export const SYSTEM_RESERVED_SLUGS = new Set([
  // 시스템 라우트
  'admin',
  'api',
  'widget',
  'login',
  'signup',
  'logout',
  'dashboard',
  'chatbots',
  'datasets',
  'documents',
  'settings',
  'mypage',
  'faq-builder',
  'review',
  'library',
  'widgets',

  // 공개 페이지
  'demo',
  'privacy',
  'terms',
  'forgot-password',
  'reset-password',
  'verify-email',
  'verify-email-change',
  'change-password',

  // 일반 예약어
  'about',
  'help',
  'support',
  'contact',
  'blog',
  'pricing',
  'features',
  'docs',
  'status',
  'home',
  'index',
  'app',

  // 특수 경로
  '_next',
  'static',
  'public',
  'assets',
  'images',
  'favicon',
]);

// 하위 호환성을 위한 alias
export const RESERVED_SLUGS = SYSTEM_RESERVED_SLUGS;

/**
 * 시스템 예약어 여부 확인 (동기)
 * 하드코딩된 예약어만 검사합니다.
 */
export function isSystemReservedSlug(slug: string): boolean {
  return SYSTEM_RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * DB 예약어 여부 확인 (비동기)
 * reserved_slugs 테이블에서 관리되는 예약어를 검사합니다.
 */
export async function isDbReservedSlug(slug: string): Promise<boolean> {
  const result = await db
    .select({ id: reservedSlugs.id })
    .from(reservedSlugs)
    .where(eq(reservedSlugs.slug, slug.toLowerCase()))
    .limit(1);

  return result.length > 0;
}

/**
 * DB 예약어 상세 정보 조회 (비동기)
 * 예약어가 DB에 있으면 상세 정보를 반환합니다.
 */
export async function getDbReservedSlugInfo(slug: string): Promise<{
  category: string;
  reason: string | null;
} | null> {
  const [result] = await db
    .select({
      category: reservedSlugs.category,
      reason: reservedSlugs.reason,
    })
    .from(reservedSlugs)
    .where(eq(reservedSlugs.slug, slug.toLowerCase()))
    .limit(1);

  return result || null;
}

/**
 * 예약어 여부 확인 (동기 - 하위 호환성)
 * 하드코딩된 시스템 예약어만 검사합니다.
 * @deprecated validateSlugAsync 사용을 권장합니다.
 */
export function isReservedSlug(slug: string): boolean {
  return isSystemReservedSlug(slug);
}

/**
 * 슬러그 유효성 검사 결과
 */
export interface SlugValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 슬러그 유효성 검사
 *
 * 규칙:
 * - 3-30자 길이
 * - 영소문자, 숫자, 하이픈만 허용
 * - 시작과 끝은 영소문자 또는 숫자
 * - 예약어 사용 불가
 * - 연속된 하이픈 금지
 */
export function validateSlug(slug: string): SlugValidationResult {
  // 빈 문자열 또는 길이 검사
  if (!slug || slug.length < 3) {
    return { valid: false, error: '슬러그는 최소 3자 이상이어야 합니다.' };
  }
  if (slug.length > 30) {
    return { valid: false, error: '슬러그는 최대 30자까지 가능합니다.' };
  }

  // 시작 문자 검사 (영소문자 또는 숫자)
  if (!/^[a-z0-9]/.test(slug)) {
    return { valid: false, error: '슬러그는 영소문자 또는 숫자로 시작해야 합니다.' };
  }

  // 끝 문자 검사 (영소문자 또는 숫자)
  if (!/[a-z0-9]$/.test(slug)) {
    return { valid: false, error: '슬러그는 영소문자 또는 숫자로 끝나야 합니다.' };
  }

  // 허용 문자 검사 (영소문자, 숫자, 하이픈만)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: '슬러그는 영소문자, 숫자, 하이픈만 사용할 수 있습니다.' };
  }

  // 연속 하이픈 검사
  if (/--/.test(slug)) {
    return { valid: false, error: '연속된 하이픈은 사용할 수 없습니다.' };
  }

  // 시스템 예약어 검사 (동기)
  if (isSystemReservedSlug(slug)) {
    return { valid: false, error: '이 슬러그는 시스템에서 사용 중입니다.' };
  }

  return { valid: true };
}

/**
 * 슬러그 유효성 검사 (비동기 - DB 예약어 포함)
 *
 * 기본 형식 검사 + 시스템 예약어 + DB 예약어를 모두 검사합니다.
 * API에서 슬러그를 최종 검증할 때 사용하세요.
 */
export async function validateSlugAsync(slug: string): Promise<SlugValidationResult> {
  // 기본 검사 (형식 + 시스템 예약어)
  const basicValidation = validateSlug(slug);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  // DB 예약어 검사
  const dbReserved = await getDbReservedSlugInfo(slug);
  if (dbReserved) {
    // 카테고리별 에러 메시지
    const categoryMessages: Record<string, string> = {
      profanity: '부적절한 단어가 포함되어 사용할 수 없습니다.',
      brand: '브랜드 관련 슬러그는 사용할 수 없습니다.',
      premium: '이 슬러그는 프리미엄 예약어입니다.',
      system: '이 슬러그는 시스템에서 사용 중입니다.',
      other: '이 슬러그는 사용할 수 없습니다.',
    };

    const errorMessage = categoryMessages[dbReserved.category] || '이 슬러그는 사용할 수 없습니다.';
    return { valid: false, error: errorMessage };
  }

  return { valid: true };
}

/**
 * 슬러그 정규화 (권장 형식으로 변환)
 *
 * 사용자 입력을 슬러그 형식에 맞게 자동 변환합니다.
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // 공백을 하이픈으로
    .replace(/[^a-z0-9-]/g, '') // 허용되지 않는 문자 제거
    .replace(/-+/g, '-') // 연속 하이픈 정리
    .replace(/^-|-$/g, ''); // 시작/끝 하이픈 제거
}

/**
 * 슬러그 추천 생성
 *
 * 챗봇 이름을 기반으로 슬러그 후보를 생성합니다.
 */
export function suggestSlug(chatbotName: string): string {
  const normalized = normalizeSlug(chatbotName);

  // 너무 짧으면 랜덤 접미사 추가
  if (normalized.length < 3) {
    const suffix = Math.random().toString(36).substring(2, 6);
    return normalized ? `${normalized}-${suffix}` : suffix;
  }

  // 너무 길면 자르기
  if (normalized.length > 30) {
    return normalized.substring(0, 30).replace(/-$/, '');
  }

  return normalized;
}
