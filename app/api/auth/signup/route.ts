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
import { sendVerificationEmail } from '@/lib/email';

const signupSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: passwordSchema,
  passwordConfirm: z.string(),
  companyName: z.string().min(2, '회사명은 2자 이상이어야 합니다.'),
  contactName: z.string().min(2, '담당자명은 2자 이상이어야 합니다.'),
  contactPhone: z.string().optional(),
  plan: z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: '이용약관에 동의해야 합니다.',
  }),
  agreedToPrivacy: z.boolean().refine((val) => val === true, {
    message: '개인정보처리방침에 동의해야 합니다.',
  }),
}).refine((data) => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['passwordConfirm'],
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

    await db.insert(tenants).values({
      id: tenantId,
      name: companyName,
      email: email,
      tier: tierMap[plan],
      usageLimits: usageLimitsMap[plan],
      settings: {
        contactName,
        contactPhone,
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

    // 7. 이메일 인증 발송
    const emailResult = await sendVerificationEmail({
      to: email,
      token: emailVerificationToken,
      userName: contactName,
    });

    if (!emailResult.success) {
      console.warn('[SIGNUP] 인증 이메일 발송 실패:', emailResult.error);
      // 이메일 발송 실패해도 가입은 완료 처리 (재발송 가능)
    }

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.',
      emailSent: emailResult.success,
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
