/**
 * 회원가입 API
 * POST /api/auth/signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users, tenants, datasets } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { hashPassword, passwordSchema } from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';
import { grantFreeTrialPoints } from '@/lib/points';

const signupSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: passwordSchema,
  // Phase 1: 폼 간소화 - 회사 정보는 온보딩에서 수집
  companyName: z.string().min(2, '회사명은 2자 이상이어야 합니다.').optional(),
  contactName: z.string().min(2, '담당자명은 2자 이상이어야 합니다.').optional(),
  contactPhone: z.string().optional(),
  plan: z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  // 통합 약관 동의 (이용약관 + 개인정보처리방침)
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: '서비스 이용약관 및 개인정보처리방침에 동의해야 합니다.',
  }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    // 2. 요청 파싱
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, undefined, {
          errors: parsed.error.issues,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const { email, password, companyName, contactName, contactPhone, plan } = parsed.data;

    // 3. 이메일 중복 확인
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json(
        new AppError(ErrorCode.EMAIL_ALREADY_EXISTS).toSafeResponse(),
        { status: 409 }
      );
    }

    // 4. 테넌트 생성
    const tenantId = uuidv4();
    const userId = uuidv4();
    const emailVerificationToken = uuidv4();

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
      enterprise: { monthlyConversations: -1, documents: -1 }, // 무제한
    };

    // 회사명이 없으면 이메일에서 기본값 생성
    const defaultCompanyName = companyName || email.split('@')[0] + '의 워크스페이스';

    await db.insert(tenants).values({
      id: tenantId,
      name: defaultCompanyName,
      email: email,
      tier: tierMap[plan],
      usageLimits: usageLimitsMap[plan],
      settings: {
        ...(contactName && { contactName }),
        ...(contactPhone && { contactPhone }),
        plan,
      },
      status: 'active',
    });

    // 5. 사용자 생성
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      tenantId,
      role: 'admin', // 테넌트 생성자는 admin
      emailVerified: false,
      emailVerificationToken,
      passwordChangedAt: new Date(),
    });

    // 6. 기본 데이터셋 생성
    await db.insert(datasets).values({
      tenantId,
      name: '기본 데이터셋',
      description: '문서를 업로드하면 자동으로 이 데이터셋에 저장됩니다.',
      isDefault: true,
    });

    // 7. 체험 포인트 지급 (500P, 1회성)
    await grantFreeTrialPoints(tenantId);

    // 8. 이메일 인증 - Delayed Verification 전략
    // 가입 시점에는 이메일을 발송하지 않고, 핵심 기능(발행 등) 사용 시 요청
    // 인증 토큰은 미리 생성해두어 나중에 재발송 시 사용

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      emailVerificationPending: true, // 이메일 인증 대기 상태
      user: {
        id: userId,
        email,
        tenantId,
      },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
