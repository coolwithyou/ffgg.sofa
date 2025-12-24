'use client';

/**
 * 테넌트 테이블 컴포넌트
 * [Week 10] 테넌트 목록 표시 및 관리
 */

import { useState, useTransition } from 'react';
import {
  updateTenantStatus,
  updateTenantTier,
  type TenantListItem,
} from './actions';

interface TenantTableProps {
  tenants: TenantListItem[];
}

export function TenantTable({ tenants: initialTenants }: TenantTableProps) {
  const [tenants, setTenants] = useState(initialTenants);
  const [isPending, startTransition] = useTransition();
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusChange = (tenantId: string, status: 'active' | 'inactive' | 'suspended') => {
    setActionTarget(tenantId);
    startTransition(async () => {
      const result = await updateTenantStatus(tenantId, status);
      if (result.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenantId ? { ...t, status } : t))
        );
      } else {
        alert(result.error || '상태 변경에 실패했습니다.');
      }
      setActionTarget(null);
    });
  };

  const handleTierChange = (tenantId: string, tier: 'free' | 'basic' | 'pro' | 'enterprise') => {
    setActionTarget(tenantId);
    startTransition(async () => {
      const result = await updateTenantTier(tenantId, tier);
      if (result.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenantId ? { ...t, tier } : t))
        );
      } else {
        alert(result.error || '티어 변경에 실패했습니다.');
      }
      setActionTarget(null);
    });
  };

  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <p className="text-gray-500">등록된 테넌트가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      {/* 검색 */}
      <div className="border-b p-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="테넌트 이름 또는 이메일 검색..."
          className="w-full max-w-md rounded-lg border px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-600">
              <th className="px-6 py-4 font-medium">테넌트</th>
              <th className="px-6 py-4 font-medium">상태</th>
              <th className="px-6 py-4 font-medium">티어</th>
              <th className="px-6 py-4 text-right font-medium">문서</th>
              <th className="px-6 py-4 text-right font-medium">청크</th>
              <th className="px-6 py-4 text-right font-medium">상담</th>
              <th className="px-6 py-4 font-medium">가입일</th>
              <th className="px-6 py-4 font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredTenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{tenant.name}</p>
                    <p className="text-xs text-gray-500">{tenant.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={tenant.status} />
                </td>
                <td className="px-6 py-4">
                  <TierBadge tier={tenant.tier} />
                </td>
                <td className="px-6 py-4 text-right text-gray-600">
                  {tenant.documentCount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-gray-600">
                  {tenant.chunkCount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-gray-600">
                  {tenant.conversationCount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {formatDate(tenant.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <ActionMenu
                    tenantId={tenant.id}
                    currentStatus={tenant.status}
                    currentTier={tenant.tier}
                    onStatusChange={handleStatusChange}
                    onTierChange={handleTierChange}
                    disabled={isPending && actionTarget === tenant.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTenants.length === 0 && searchQuery && (
        <div className="p-8 text-center text-gray-500">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}

// 상태 배지
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: '활성', className: 'bg-green-100 text-green-700' },
    inactive: { label: '비활성', className: 'bg-gray-100 text-gray-700' },
    suspended: { label: '정지', className: 'bg-red-100 text-red-700' },
  };

  const { label, className } = config[status] || config.active;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 티어 배지
function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { label: string; className: string }> = {
    free: { label: 'Free', className: 'bg-gray-100 text-gray-700' },
    basic: { label: 'Basic', className: 'bg-blue-100 text-blue-700' },
    pro: { label: 'Pro', className: 'bg-purple-100 text-purple-700' },
    enterprise: { label: 'Enterprise', className: 'bg-orange-100 text-orange-700' },
  };

  const { label, className } = config[tier] || config.free;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 액션 메뉴
interface ActionMenuProps {
  tenantId: string;
  currentStatus: string;
  currentTier: string;
  onStatusChange: (id: string, status: 'active' | 'inactive' | 'suspended') => void;
  onTierChange: (id: string, tier: 'free' | 'basic' | 'pro' | 'enterprise') => void;
  disabled: boolean;
}

function ActionMenu({
  tenantId,
  currentStatus,
  currentTier,
  onStatusChange,
  onTierChange,
  disabled,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
            <div className="px-3 py-2 text-xs font-medium text-gray-500">상태 변경</div>
            {(['active', 'inactive', 'suspended'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  onStatusChange(tenantId, status);
                  setIsOpen(false);
                }}
                disabled={currentStatus === status}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {status === 'active' && '활성화'}
                {status === 'inactive' && '비활성화'}
                {status === 'suspended' && '정지'}
                {currentStatus === status && (
                  <span className="ml-auto text-xs text-gray-400">현재</span>
                )}
              </button>
            ))}
            <div className="my-1 border-t" />
            <div className="px-3 py-2 text-xs font-medium text-gray-500">티어 변경</div>
            {(['free', 'basic', 'pro', 'enterprise'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => {
                  onTierChange(tenantId, tier);
                  setIsOpen(false);
                }}
                disabled={currentTier === tier}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
                {currentTier === tier && (
                  <span className="ml-auto text-xs text-gray-400">현재</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 유틸리티
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  );
}
