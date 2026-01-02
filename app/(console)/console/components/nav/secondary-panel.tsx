'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { type NavItem } from './nav-config';
import { ChevronRight } from 'lucide-react';

interface SecondaryPanelProps {
  /** 현재 선택된 1차 메뉴 아이템 */
  activeNavItem: NavItem | null;
  /** 추가 컨텐츠 (예: 챗봇 목록) */
  children?: React.ReactNode;
}

/**
 * 2차 네비게이션 패널 (컨텍스트별 메뉴)
 *
 * 스펙:
 * - 폭: 240px 고정
 * - 선택된 1차 메뉴에 따라 서브메뉴 표시
 * - 추가 컨텍스트 (챗봇 목록 등) 표시 가능
 */
export function SecondaryPanel({ activeNavItem, children }: SecondaryPanelProps) {
  const pathname = usePathname();

  // 서브메뉴가 없으면 렌더링하지 않음
  if (!activeNavItem?.subItems && !children) {
    return null;
  }

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card/50">
      {/* 섹션 헤더 */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <h2 className="text-sm font-semibold text-foreground">
          {activeNavItem?.label}
        </h2>
      </div>

      {/* 서브메뉴 */}
      {activeNavItem?.subItems && (
        <div className="p-3">
          <nav className="space-y-1">
            {activeNavItem.subItems.map((subItem) => {
              const isActive = pathname === subItem.href;

              return (
                <Link
                  key={subItem.id}
                  href={subItem.href}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span>{subItem.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4" />}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* 추가 컨텐츠 (예: 챗봇 목록) */}
      {children && (
        <div className="flex-1 overflow-y-auto border-t border-border">
          {children}
        </div>
      )}
    </aside>
  );
}

/**
 * Secondary Panel 내 섹션 컴포넌트
 */
export function SecondaryPanelSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3">
      {title && (
        <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
