/**
 * Google OAuth 콜백 API
 * GET /api/auth/google/callback
 *
 * Google에서 인증 후 리다이렉트되는 엔드포인트입니다.
 * 1. Authorization code를 access token으로 교환
 * 2. Google API로 사용자 정보 조회
 * 3. 신규 사용자: 테넌트/사용자 생성
 * 4. 기존 사용자: 로그인 처리
 * 5. 세션 생성 후 /console로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, users, tenants, datasets } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { logLoginSuccess } from '@/lib/audit/logger';

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 에러 처리 (사용자가 취소한 경우 등)
    if (error) {
      console.error('[GOOGLE_CALLBACK] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/signup?error=${error}`, appUrl)
      );
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[GOOGLE_CALLBACK] OAuth 환경변수가 설정되지 않았습니다.');
      return NextResponse.redirect(
        new URL('/signup?error=oauth_not_configured', appUrl)
      );
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // 1. Authorization code를 access token으로 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[GOOGLE_CALLBACK] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/signup?error=token_exchange_failed', appUrl)
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // 2. Google API로 사용자 정보 조회
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userInfoResponse.ok) {
      console.error('[GOOGLE_CALLBACK] Failed to fetch user info');
      return NextResponse.redirect(
        new URL('/signup?error=userinfo_failed', appUrl)
      );
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    // 이메일 필수 검증
    if (!googleUser.email || !googleUser.verified_email) {
      return NextResponse.redirect(
        new URL('/signup?error=email_not_verified', appUrl)
      );
    }

    // 3. 기존 사용자 조회
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, googleUser.email.toLowerCase()),
    });

    let userId: string;
    let tenantId: string;
    let userRole: 'user' | 'admin' | 'internal_operator' = 'admin';

    if (existingUser) {
      // 기존 사용자 로그인
      userId = existingUser.id;
      tenantId = existingUser.tenantId || '';
      userRole = (existingUser.role || 'user') as typeof userRole;

      // Google 정보 업데이트 (선택적)
      await db
        .update(users)
        .set({
          googleId: googleUser.id,
          avatarUrl: existingUser.avatarUrl || googleUser.picture,
          emailVerified: true, // Google 인증 이메일은 자동 인증
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      // 신규 사용자 생성
      if (mode === 'login') {
        // 로그인 모드인데 사용자가 없는 경우
        return NextResponse.redirect(
          new URL('/login?error=no_account', appUrl)
        );
      }

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
      const defaultCompanyName =
        googleUser.email.split('@')[0] + '의 워크스페이스';

      await db.insert(tenants).values({
        id: tenantId,
        name: defaultCompanyName,
        email: googleUser.email,
        tier: tierMap[plan] || 'basic',
        usageLimits: usageLimitsMap[plan] || usageLimitsMap.starter,
        settings: {
          contactName: googleUser.name,
          plan,
          signupMethod: 'google',
        },
        status: 'active',
      });

      // 사용자 생성 (비밀번호 없음 - OAuth 전용)
      await db.insert(users).values({
        id: userId,
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        passwordHash: '', // OAuth 사용자는 비밀번호 없음
        tenantId,
        role: 'admin',
        emailVerified: true, // Google 인증 이메일은 자동 인증
        googleId: googleUser.id,
        avatarUrl: googleUser.picture,
      });

      // 기본 데이터셋 생성
      await db.insert(datasets).values({
        tenantId,
        name: '기본 데이터셋',
        description: '문서를 업로드하면 자동으로 이 데이터셋에 저장됩니다.',
        isDefault: true,
      });
    }

    // 4. 세션 생성
    await createSession({
      userId,
      email: googleUser.email,
      tenantId,
      role: userRole,
    });

    // 5. 로그인 성공 로깅
    await logLoginSuccess(request, userId, tenantId || undefined);

    // 6. 콘솔로 리다이렉트
    return NextResponse.redirect(new URL('/console', appUrl));
  } catch (error) {
    console.error('[GOOGLE_CALLBACK]', error);
    return NextResponse.redirect(
      new URL('/signup?error=unknown_error', appUrl)
    );
  }
}
