/**
 * 공개 페이지 슬러그 예약어 및 유효성 검사
 *
 * 슬러그는 공개 페이지 URL에서 사용되는 고유 식별자입니다.
 * 시스템 라우트와 충돌을 방지하기 위해 특정 슬러그는 예약되어 있습니다.
 */

/**
 * 슬러그로 사용할 수 없는 예약어 목록
 * 시스템 라우트, 공개 페이지, 일반 예약어를 포함
 */
export const RESERVED_SLUGS = new Set([
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

/**
 * 예약어 여부 확인
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
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

  // 예약어 검사
  if (isReservedSlug(slug)) {
    return { valid: false, error: '이 슬러그는 시스템에서 사용 중입니다.' };
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
