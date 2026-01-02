/**
 * Next.js Proxy (Next.js 16+)
 * - 인증이 필요한 경로 보호
 * - 보안 헤더 설정
 * - 공개 경로 및 정적 파일 제외
 *
 * Note: Next.js 16부터 middleware.ts가 proxy.ts로 변경됨
 */

import { NextRequest, NextResponse } from 'next/server';

// 공개 경로 (인증 불필요)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/privacy',
  '/terms',
  '/demo',
];

// 동적 공개 경로 패턴 (인증 불필요)
const PUBLIC_PATH_PATTERNS = [
  /^\/widget\/[^/]+$/, // /widget/[tenantId] - 챗봇 위젯 iframe
  /^\/[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/, // /[slug] - 공개 페이지 (3-30자)
];

// 공개 페이지 슬러그 패턴 (X-Frame-Options 처리용)
const PUBLIC_PAGE_PATTERN = /^\/[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// API 공개 경로 (인증 불필요)
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/health',
  '/api/inngest', // Inngest 웹훅 엔드포인트 (서버 간 통신)
  '/api/admin/documents', // 관리자 문서 API (개발용)
  '/api/widget', // 위젯 API (외부 사이트에서 호출)
];

// 정적 파일 및 Next.js 내부 경로
const IGNORED_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/widget.js', // 챗봇 위젯 로더 스크립트
];

/**
 * 경로가 공개 경로인지 확인
 */
function isPublicPath(pathname: string): boolean {
  // 정확히 일치하는 공개 경로
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  // 동적 공개 경로 패턴 확인
  if (PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return true;
  }

  // API 공개 경로
  if (PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))) {
    return true;
  }

  return false;
}

/**
 * 무시할 경로인지 확인
 */
function isIgnoredPath(pathname: string): boolean {
  return IGNORED_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * 위젯 경로인지 확인 (iframe 임베드 허용)
 */
function isWidgetPath(pathname: string): boolean {
  return /^\/widget\/[^/]+$/.test(pathname);
}

/**
 * 공개 페이지 경로인지 확인 (iframe 차단)
 */
function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_PAGE_PATTERN.test(pathname);
}

/**
 * 보안 헤더 추가
 * [W-007] 보안 헤더 설정
 */
function addSecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  // XSS 방지
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // MIME 스니핑 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 클릭재킹 방지 (위젯 경로는 iframe 임베드 허용)
  if (!isWidgetPath(pathname)) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  // Referrer 정책
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 권한 정책
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // HTTPS 강제 (프로덕션)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일 및 내부 경로 무시
  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  // 공개 경로는 보안 헤더만 추가하고 통과
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    return addSecurityHeaders(response, pathname);
  }

  // 인증이 필요한 경로: 세션 쿠키 확인
  // Edge Runtime에서는 iron-session 직접 파싱이 제한적이므로
  // 쿠키 존재 여부로 1차 확인 (상세 검증은 각 페이지/API에서 수행)
  const sessionCookie = request.cookies.get('sofa_session');

  if (!sessionCookie) {
    // 세션 쿠키가 없으면 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);

    const response = NextResponse.redirect(loginUrl);
    return addSecurityHeaders(response, pathname);
  }

  // 세션 쿠키가 있으면 통과 (상세 검증은 페이지/API에서)
  const response = NextResponse.next();
  return addSecurityHeaders(response, pathname);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
