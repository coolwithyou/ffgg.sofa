'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { navItems, findActiveNavItem, type NavItem } from './nav-config';

interface PrimaryNavProps {
  /** 선택된 메뉴 아이템 ID (controlled mode) */
  activeId?: string;
  /** 메뉴 선택 시 콜백 */
  onSelect?: (item: NavItem) => void;
}

/**
 * 1차 네비게이션 (아이콘 + 짧은 라벨)
 *
 * 스펙:
 * - 폭: 80px 고정
 * - 아이콘 24px + 짧은 라벨 수직 배치
 * - 호버 시 배경색 변경
 * - 활성화 시 좌측 액센트 바
 */
export function PrimaryNav({ activeId, onSelect }: PrimaryNavProps) {
  const pathname = usePathname();

  // activeId가 제공되지 않으면 pathname에서 추론
  const currentActiveId =
    activeId ?? findActiveNavItem(pathname)?.id ?? 'appearance';

  return (
    <nav className="flex w-20 flex-col border-r border-border bg-card">
      {/* 로고 영역 */}
      <div className="flex h-14 items-center justify-center border-b border-border">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-primary"
        >
          SOFA
        </Link>
      </div>

      {/* 메뉴 아이템 */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive = currentActiveId === item.id;
          const Icon = item.icon;

          const content = (
            <div
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg px-2 py-3 transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {/* 활성화 인디케이터 (좌측 바) */}
              {isActive && (
                <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}

              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </div>
          );

          // subItems가 있으면 클릭 핸들러, 없으면 직접 링크
          if (item.subItems && onSelect) {
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full"
              >
                {content}
              </button>
            );
          }

          // subItems가 없으면 직접 링크
          const href = item.href ?? item.subItems?.[0]?.href ?? '/console';
          return (
            <Link
              key={item.id}
              href={href}
              onClick={() => onSelect?.(item)}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
