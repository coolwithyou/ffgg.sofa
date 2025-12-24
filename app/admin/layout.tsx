/**
 * 관리자 레이아웃
 * [Week 10] 내부 운영자용 관리 포털
 */

import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminHeader } from '@/components/admin/header';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // iron-session 기반 세션 검증
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  // internal_operator 역할만 접근 가능
  if (session.role !== 'internal_operator' && session.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 사이드바 */}
      <AdminSidebar operatorEmail={session.email} />

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <AdminHeader operatorName={session.email.split('@')[0]} />

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
