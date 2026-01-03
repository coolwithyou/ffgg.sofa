/**
 * Google OAuth 시작 API
 * GET /api/auth/google
 *
 * Google OAuth 2.0 인증 페이지로 리다이렉트합니다.
 * state 파라미터에 plan 정보를 포함하여 콜백에서 사용합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    // Rate Limiting
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    const { searchParams } = new URL(request.url);
    const plan = searchParams.get('plan') || 'starter';
    const mode = searchParams.get('mode') || 'signup'; // signup or login

    // 환경변수 검증
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!clientId) {
      console.error('[GOOGLE_OAUTH] GOOGLE_CLIENT_ID가 설정되지 않았습니다.');
      return NextResponse.redirect(
        new URL(`/signup?error=oauth_not_configured`, appUrl)
      );
    }

    // Callback URL 구성
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // State에 plan과 mode 정보 포함 (CSRF 방지용 랜덤값도 포함)
    const stateData = {
      plan,
      mode,
      nonce: crypto.randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Google OAuth URL 구성
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('[GOOGLE_OAUTH]', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      new URL('/signup?error=oauth_error', appUrl)
    );
  }
}
