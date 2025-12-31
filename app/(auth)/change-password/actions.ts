'use server';

/**
 * 비밀번호 변경 서버 액션
 */

import { validateSession, createSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { hash, compare } from 'bcryptjs';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요.'),
  newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '새 비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
});

export async function changePassword(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  const rawData = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const parseResult = changePasswordSchema.safeParse(rawData);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message };
  }

  const { currentPassword, newPassword } = parseResult.data;

  try {
    // 현재 사용자 정보 조회
    const [user] = await db
      .select({
        passwordHash: users.passwordHash,
        role: users.role,
        adminRole: users.adminRole,
        isPlatformAdmin: users.isPlatformAdmin,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.passwordHash) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return { success: false, error: '현재 비밀번호가 올바르지 않습니다.' };
    }

    // 새 비밀번호가 현재와 같은지 확인
    const isSamePassword = await compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return { success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' };
    }

    // 새 비밀번호 해시
    const hashedPassword = await hash(newPassword, 12);

    // 비밀번호 업데이트 및 mustChangePassword 플래그 해제
    await db
      .update(users)
      .set({
        passwordHash: hashedPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    // 세션 갱신 (mustChangePassword: false로)
    await createSession({
      userId: session.userId,
      email: session.email,
      tenantId: user.tenantId || '',
      role: (user.role || 'user') as 'user' | 'admin' | 'internal_operator',
      adminRole: user.adminRole as 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'VIEWER' | undefined,
      isPlatformAdmin: user.isPlatformAdmin ?? undefined,
      mustChangePassword: false,
    });

    logger.info('Password changed successfully', { userId: session.userId });

    return { success: true };
  } catch (error) {
    logger.error('Failed to change password', error as Error, { userId: session.userId });
    return { success: false, error: '비밀번호 변경에 실패했습니다.' };
  }
}
