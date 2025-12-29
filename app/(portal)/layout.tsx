/**
 * 고객 포털 레이아웃
 * [Week 9] 테넌트용 관리 포털
 */

import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import { PortalSidebar } from '@/components/portal/sidebar';
import { PortalHeader } from '@/components/portal/header';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  // iron-session 기반 세션 검증
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-background">
      {/* 사이드바 */}
      <PortalSidebar tenantName={session.email.split('@')[0] || '테넌트'} />

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <PortalHeader userName={session.email.split('@')[0] || '사용자'} />

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
