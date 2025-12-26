/**
 * Next.js Middleware
 * - 인증이 필요한 경로 보호
 * - 보안 헤더 설정
 * - 공개 경로 및 정적 파일 제외
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
];

// 정적 파일 및 Next.js 내부 경로
const IGNORED_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

/**
 * 경로가 공개 경로인지 확인
 */
function isPublicPath(pathname: string): boolean {
  // 정확히 일치하는 공개 경로
  if (PUBLIC_PATHS.includes(pathname)) {
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
 * 보안 헤더 추가
 * [W-007] 보안 헤더 설정
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // XSS 방지
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // MIME 스니핑 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 클릭재킹 방지
  response.headers.set('X-Frame-Options', 'DENY');

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일 및 내부 경로 무시
  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  // 공개 경로는 보안 헤더만 추가하고 통과
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
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
    return addSecurityHeaders(response);
  }

  // 세션 쿠키가 있으면 통과 (상세 검증은 페이지/API에서)
  const response = NextResponse.next();
  return addSecurityHeaders(response);
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
