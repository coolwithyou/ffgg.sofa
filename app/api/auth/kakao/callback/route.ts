/**
 * 카카오 OAuth 콜백 API
 * GET /api/auth/kakao/callback
 *
 * 카카오에서 인증 후 리다이렉트되는 엔드포인트입니다.
 * 1. Authorization code를 access token으로 교환
 * 2. 카카오 API로 사용자 정보 조회
 * 3. 신규 사용자: 테넌트/사용자 생성
 * 4. 기존 사용자: 로그인 처리
 * 5. 세션 생성 후 /console로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, users, tenants, datasets } from '@/lib/db';
import { eq, or } from 'drizzle-orm';
import { createSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { logLoginSuccess } from '@/lib/audit/logger';
import { grantFreeTrialPoints } from '@/lib/points';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  refresh_token_expires_in?: number;
}

interface KakaoUserInfo {
  id: number;
  connected_at?: string;
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // 에러 처리 (사용자가 취소한 경우 등)
    if (error) {
      console.error(
        '[KAKAO_CALLBACK] OAuth error:',
        error,
        errorDescription
      );
      return NextResponse.redirect(new URL(`/signup?error=${error}`, appUrl));
    }

    // 필수 파라미터 검증
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/signup?error=missing_params', appUrl)
      );
    }

    // State 파싱
    let stateData: { plan: string; mode: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/signup?error=invalid_state', appUrl)
      );
    }

    const { plan = 'starter', mode = 'signup' } = stateData;

    // 환경변수 검증
    const clientId = process.env.KAKAO_CLIENT_ID;
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;

    if (!clientId) {
      console.error(
        '[KAKAO_CALLBACK] KAKAO_CLIENT_ID가 설정되지 않았습니다.'
      );
      return NextResponse.redirect(
        new URL('/signup?error=oauth_not_configured', appUrl)
      );
    }

    const redirectUri = `${appUrl}/api/auth/kakao/callback`;

    // 1. Authorization code를 access token으로 교환
    // https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#request-token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    // client_secret은 선택사항 (카카오 앱 설정에 따라)
    if (clientSecret) {
      tokenParams.set('client_secret', clientSecret);
    }

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[KAKAO_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/signup?error=token_exchange_failed', appUrl)
      );
    }

    const tokens: KakaoTokenResponse = await tokenResponse.json();

    // 2. 카카오 API로 사용자 정보 조회
    // https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info
    const userInfoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!userInfoResponse.ok) {
      console.error('[KAKAO_CALLBACK] Failed to fetch user info');
      return NextResponse.redirect(
        new URL('/signup?error=userinfo_failed', appUrl)
      );
    }

    const kakaoUser: KakaoUserInfo = await userInfoResponse.json();
    const kakaoId = String(kakaoUser.id);

    // 사용자 정보 추출
    const email = kakaoUser.kakao_account?.email?.toLowerCase();
    const nickname =
      kakaoUser.kakao_account?.profile?.nickname ||
      kakaoUser.properties?.nickname ||
      `카카오사용자${kakaoId.slice(-4)}`;
    const profileImage =
      kakaoUser.kakao_account?.profile?.profile_image_url ||
      kakaoUser.properties?.profile_image;

    // 이메일 검증 (카카오는 이메일이 없을 수 있음)
    const isEmailVerified = kakaoUser.kakao_account?.is_email_verified;

    // 3. 기존 사용자 조회 (kakaoId 또는 이메일로)
    let existingUser;
    if (email) {
      existingUser = await db.query.users.findFirst({
        where: or(eq(users.kakaoId, kakaoId), eq(users.email, email)),
      });
    } else {
      existingUser = await db.query.users.findFirst({
        where: eq(users.kakaoId, kakaoId),
      });
    }

    let userId: string;
    let tenantId: string;
    let userRole: 'user' | 'admin' | 'internal_operator' = 'admin';

    if (existingUser) {
      // 기존 사용자 로그인
      userId = existingUser.id;
      userRole = (existingUser.role || 'user') as typeof userRole;

      // tenantId 유효성 검사
      if (!existingUser.tenantId) {
        console.error('[KAKAO_CALLBACK] 사용자에게 tenantId가 없습니다:', existingUser.email);
        return NextResponse.redirect(
          new URL('/login?error=invalid_account', appUrl)
        );
      }
      tenantId = existingUser.tenantId;

      // 카카오 정보 업데이트
      await db
        .update(users)
        .set({
          kakaoId: kakaoId,
          avatarUrl: existingUser.avatarUrl || profileImage,
          emailVerified: existingUser.emailVerified || isEmailVerified,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      // 신규 사용자 생성
      // 로그인 모드에서도 계정이 없으면 자동으로 회원가입 처리 (OAuth UX 개선)

      // 이메일이 없으면 임시 이메일 생성 (카카오는 이메일 권한이 없을 수 있음)
      const userEmail = email || `kakao_${kakaoId}@kakao.placeholder`;

      tenantId = uuidv4();
      userId = uuidv4();

      // 티어 설정
      const tierMap: Record<string, string> = {
        starter: 'basic',
        pro: 'standard',
        enterprise: 'premium',
      };

      // 사용량 한도 설정
      const usageLimitsMap: Record<string, object> = {
        starter: { monthlyConversations: 1000, documents: 10 },
        pro: { monthlyConversations: 5000, documents: 50 },
        enterprise: { monthlyConversations: -1, documents: -1 },
      };

      // 테넌트 생성
      const defaultCompanyName = `${nickname}의 워크스페이스`;

      await db.insert(tenants).values({
        id: tenantId,
        name: defaultCompanyName,
        email: userEmail,
        tier: tierMap[plan] || 'basic',
        usageLimits: usageLimitsMap[plan] || usageLimitsMap.starter,
        settings: {
          contactName: nickname,
          plan,
          signupMethod: 'kakao',
        },
        status: 'active',
      });

      // 사용자 생성 (비밀번호 없음 - OAuth 전용)
      await db.insert(users).values({
        id: userId,
        email: userEmail,
        name: nickname,
        passwordHash: '', // OAuth 사용자는 비밀번호 없음
        tenantId,
        role: 'admin',
        emailVerified: isEmailVerified || false,
        kakaoId: kakaoId,
        avatarUrl: profileImage,
      });

      // 기본 데이터셋 생성
      await db.insert(datasets).values({
        tenantId,
        name: '기본 데이터셋',
        description: '문서를 업로드하면 자동으로 이 데이터셋에 저장됩니다.',
        isDefault: true,
      });

      // 체험 포인트 지급 (500P, 1회성)
      await grantFreeTrialPoints(tenantId);
    }

    // 4. 세션 생성
    await createSession({
      userId,
      email: existingUser?.email || email || `kakao_${kakaoId}@kakao.placeholder`,
      tenantId,
      role: userRole,
    });

    // 5. 로그인 성공 로깅
    await logLoginSuccess(request, userId, tenantId || undefined);

    // 6. 콘솔로 리다이렉트
    return NextResponse.redirect(new URL('/console', appUrl));
  } catch (error) {
    console.error('[KAKAO_CALLBACK]', error);
    return NextResponse.redirect(
      new URL('/signup?error=unknown_error', appUrl)
    );
  }
}
