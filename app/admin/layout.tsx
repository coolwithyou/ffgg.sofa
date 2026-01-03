/**
 * 관리자 레이아웃
 * [Week 10] 내부 운영자용 관리 포털
 */

import { redirect } from 'next/navigation';
import { validateSession, SESSION_TTL } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminHeader } from '@/components/admin/header';
import { AdminProviders } from '@/components/admin/providers';
import { isOperator } from '@/lib/auth/admin-permissions';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // iron-session 기반 세션 검증
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  // 플랫폼 관리자 또는 기존 internal_operator/admin 역할만 접근 가능
  const isPlatformOperator = isOperator(session);
  const hasLegacyAccess = session.role === 'internal_operator' || session.role === 'admin';

  if (!isPlatformOperator && !hasLegacyAccess) {
    redirect('/console');
  }

  // 임시 비밀번호 변경 필요 시 비밀번호 변경 페이지로 리다이렉트
  if (session.mustChangePassword) {
    redirect('/change-password');
  }

  // 세션 만료 시간 (기존 세션 호환성을 위해 expiresAt이 없으면 계산)
  const sessionExpiresAt =
    session.expiresAt || Math.floor(Date.now() / 1000) + SESSION_TTL;

  return (
    <AdminProviders>
      <div className="flex h-screen bg-background">
        {/* 사이드바 */}
        <AdminSidebar operatorEmail={session.email} adminRole={session.adminRole} />

        {/* 메인 콘텐츠 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 헤더 */}
          <AdminHeader
            operatorName={session.email.split('@')[0]}
            sessionExpiresAt={sessionExpiresAt}
          />

          {/* 페이지 콘텐츠 */}
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
