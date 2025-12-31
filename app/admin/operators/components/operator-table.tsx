'use client';

/**
 * 관리자 목록 테이블 컴포넌트
 */

import { useState, useTransition } from 'react';
import type { OperatorListItem } from '../actions';
import {
  updateOperatorRole,
  deactivateOperator,
  reactivateOperator,
  deleteOperator,
  resetOperatorPassword,
} from '../actions';
import type { AdminRole } from '@/lib/auth/admin-types';
import { ADMIN_ROLE_LABELS } from '@/lib/auth/admin-types';

interface OperatorTableProps {
  operators: OperatorListItem[];
  currentUserId: string;
  isSuperAdmin: boolean;
}

export function OperatorTable({ operators, currentUserId, isSuperAdmin }: OperatorTableProps) {
  const [isPending, startTransition] = useTransition();
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = (operatorId: string, newRole: AdminRole) => {
    setError(null);
    setActionTarget(operatorId);
    startTransition(async () => {
      const result = await updateOperatorRole(operatorId, newRole);
      if (!result.success) {
        setError(result.error || '역할 변경 실패');
      }
      setActionTarget(null);
    });
  };

  const handleDeactivate = (operatorId: string) => {
    if (!confirm('이 관리자를 비활성화하시겠습니까?')) return;
    setError(null);
    setActionTarget(operatorId);
    startTransition(async () => {
      const result = await deactivateOperator(operatorId);
      if (!result.success) {
        setError(result.error || '비활성화 실패');
      }
      setActionTarget(null);
    });
  };

  const handleReactivate = (operatorId: string) => {
    setError(null);
    setActionTarget(operatorId);
    startTransition(async () => {
      const result = await reactivateOperator(operatorId);
      if (!result.success) {
        setError(result.error || '재활성화 실패');
      }
      setActionTarget(null);
    });
  };

  const handleDelete = (operatorId: string) => {
    if (!confirm('이 관리자를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    setError(null);
    setActionTarget(operatorId);
    startTransition(async () => {
      const result = await deleteOperator(operatorId);
      if (!result.success) {
        setError(result.error || '삭제 실패');
      }
      setActionTarget(null);
    });
  };

  const handleResetPassword = (operatorId: string) => {
    if (!confirm('비밀번호를 초기화하시겠습니까? 임시 비밀번호가 생성됩니다.')) return;
    setError(null);
    setActionTarget(operatorId);
    startTransition(async () => {
      const result = await resetOperatorPassword(operatorId);
      if (result.success && result.data) {
        setTempPassword(result.data.temporaryPassword);
      } else {
        setError(result.error || '비밀번호 초기화 실패');
      }
      setActionTarget(null);
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadgeClass = (role: AdminRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-500/10 text-purple-500';
      case 'ADMIN':
        return 'bg-primary/10 text-primary';
      case 'SUPPORT':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'VIEWER':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* 에러 알림 */}
      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-3 text-destructive">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-sm underline hover:no-underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 임시 비밀번호 알림 */}
      {tempPassword && (
        <div className="border-b border-border bg-green-500/10 px-4 py-3 text-green-500">
          임시 비밀번호: <code className="rounded bg-card px-2 py-1 font-mono">{tempPassword}</code>
          <span className="ml-2 text-sm">이 비밀번호를 안전하게 전달하세요.</span>
          <button
            onClick={() => setTempPassword(null)}
            className="ml-2 text-sm underline hover:no-underline"
          >
            닫기
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                관리자
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                역할
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                상태
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                2FA
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                마지막 로그인
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                생성일
              </th>
              {isSuperAdmin && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  작업
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {operators.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  등록된 관리자가 없습니다.
                </td>
              </tr>
            ) : (
              operators.map((operator) => {
                const isCurrentUser = operator.id === currentUserId;
                const isLoading = isPending && actionTarget === operator.id;

                return (
                  <tr
                    key={operator.id}
                    className={`hover:bg-muted/50 ${isLoading ? 'opacity-50' : ''}`}
                  >
                    {/* 관리자 정보 */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {operator.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {operator.name}
                            {isCurrentUser && (
                              <span className="ml-1 text-xs text-muted-foreground">(나)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{operator.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* 역할 */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {isSuperAdmin && !isCurrentUser ? (
                        <select
                          value={operator.adminRole}
                          onChange={(e) =>
                            handleRoleChange(operator.id, e.target.value as AdminRole)
                          }
                          disabled={isLoading}
                          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'] as AdminRole[]).map(
                            (role) => (
                              <option key={role} value={role}>
                                {ADMIN_ROLE_LABELS[role]}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(operator.adminRole)}`}
                        >
                          {ADMIN_ROLE_LABELS[operator.adminRole]}
                        </span>
                      )}
                    </td>

                    {/* 상태 */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {operator.isActive ? (
                        <span className="inline-flex items-center gap-1 text-sm text-green-500">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                          비활성
                        </span>
                      )}
                      {operator.mustChangePassword && (
                        <span className="ml-2 text-xs text-yellow-500">(비밀번호 변경 필요)</span>
                      )}
                    </td>

                    {/* 2FA */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {operator.has2FA ? (
                        <span className="text-sm text-green-500">활성화</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">미설정</span>
                      )}
                    </td>

                    {/* 마지막 로그인 */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(operator.lastLoginAt)}
                    </td>

                    {/* 생성일 */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(operator.createdAt)}
                      {operator.invitedByEmail && (
                        <p className="text-xs">by {operator.invitedByEmail}</p>
                      )}
                    </td>

                    {/* 작업 버튼 (SUPER_ADMIN만) */}
                    {isSuperAdmin && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {!isCurrentUser && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResetPassword(operator.id)}
                              disabled={isLoading}
                              className="text-sm text-muted-foreground hover:text-foreground"
                              title="비밀번호 초기화"
                            >
                              초기화
                            </button>
                            {operator.isActive ? (
                              <button
                                onClick={() => handleDeactivate(operator.id)}
                                disabled={isLoading}
                                className="text-sm text-yellow-500 hover:text-yellow-600"
                              >
                                비활성화
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(operator.id)}
                                disabled={isLoading}
                                className="text-sm text-green-500 hover:text-green-600"
                              >
                                활성화
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(operator.id)}
                              disabled={isLoading}
                              className="text-sm text-destructive hover:text-destructive/80"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
