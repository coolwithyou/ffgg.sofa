/**
 * 카카오 OAuth 시작 API
 * GET /api/auth/kakao
 *
 * 카카오 OAuth 2.0 인증 페이지로 리다이렉트합니다.
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
    const clientId = process.env.KAKAO_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!clientId) {
      console.error('[KAKAO_OAUTH] KAKAO_CLIENT_ID가 설정되지 않았습니다.');
      return NextResponse.redirect(
        new URL(`/signup?error=oauth_not_configured`, appUrl)
      );
    }

    // Callback URL 구성
    const redirectUri = `${appUrl}/api/auth/kakao/callback`;

    // State에 plan과 mode 정보 포함 (CSRF 방지용 랜덤값도 포함)
    const stateData = {
      plan,
      mode,
      nonce: crypto.randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // 카카오 OAuth URL 구성
    // https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#request-code
    const kakaoAuthUrl = new URL('https://kauth.kakao.com/oauth/authorize');
    kakaoAuthUrl.searchParams.set('client_id', clientId);
    kakaoAuthUrl.searchParams.set('redirect_uri', redirectUri);
    kakaoAuthUrl.searchParams.set('response_type', 'code');
    kakaoAuthUrl.searchParams.set('state', state);
    // scope: 닉네임, 이메일 요청 (이메일은 카카오 비즈앱에서 권한 필요)
    kakaoAuthUrl.searchParams.set('scope', 'profile_nickname account_email');

    return NextResponse.redirect(kakaoAuthUrl.toString());
  } catch (error) {
    console.error('[KAKAO_OAUTH]', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(new URL('/signup?error=oauth_error', appUrl));
  }
}
