/**
 * 플랫폼 관리자 계정 관리 페이지
 * ADMIN 이상 권한 필요
 */

import { getOperatorList, getOperatorStats } from './actions';
import { OperatorTable } from './components/operator-table';
import { OperatorStats } from './components/operator-stats';
import { CreateOperatorButton } from './components/create-operator-button';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasRoleOrHigher, type AdminRole } from '@/lib/auth/admin-permissions';

export default async function OperatorsPage() {
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  // ADMIN 이상만 접근 가능
  const hasAccess =
    hasRoleOrHigher(session.adminRole, 'ADMIN') ||
    session.role === 'internal_operator' ||
    session.role === 'admin';

  if (!hasAccess) {
    redirect('/admin/dashboard');
  }

  const [operators, stats] = await Promise.all([getOperatorList(), getOperatorStats()]);

  const isSuperAdmin = session.adminRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">관리자 계정</h1>
          <p className="text-muted-foreground">
            Admin 콘솔에 접근할 수 있는 플랫폼 관리자를 관리합니다.
          </p>
        </div>
        {isSuperAdmin && <CreateOperatorButton />}
      </div>

      {/* 통계 요약 */}
      {stats && <OperatorStats stats={stats} />}

      {/* 관리자 테이블 */}
      <OperatorTable
        operators={operators}
        currentUserId={session.userId}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
