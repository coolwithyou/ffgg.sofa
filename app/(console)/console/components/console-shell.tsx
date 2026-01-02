'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  PrimaryNav,
  SecondaryPanel,
  ChatbotSelector,
  findActiveNavItem,
  type NavItem,
} from './nav';
import { ConsoleTopBar } from './console-top-bar';

interface ConsoleShellProps {
  children: React.ReactNode;
}

/**
 * Console Shell
 *
 * 2-레벨 네비게이션을 포함한 Console 전체 레이아웃 셸
 *
 * 레이아웃 구조:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        Top Bar (56px)                           │
 * ├─────────┬───────────┬───────────────────────────────────────────┤
 * │         │           │                                           │
 * │ Primary │ Secondary │                                           │
 * │  Nav    │  Panel    │          Main Content Area                │
 * │ (80px)  │ (240px)   │                                           │
 * │         │           │                                           │
 * └─────────┴───────────┴───────────────────────────────────────────┘
 */
export function ConsoleShell({ children }: ConsoleShellProps) {
  const pathname = usePathname();
  const [activeNavItem, setActiveNavItem] = useState<NavItem | null>(null);

  // pathname이 변경되면 활성 네비게이션 아이템 업데이트
  useEffect(() => {
    const item = findActiveNavItem(pathname);
    if (item) {
      setActiveNavItem(item);
    }
  }, [pathname]);

  const handleNavSelect = (item: NavItem) => {
    setActiveNavItem(item);
  };

  // 현재 메뉴가 Appearance인지 확인 (챗봇 선택기 표시용)
  const showChatbotSelector = activeNavItem?.id === 'appearance';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* 상단 바 */}
      <ConsoleTopBar />

      {/* 메인 영역 (네비게이션 + 컨텐츠) */}
      <div className="flex flex-1 overflow-hidden">
        {/* 1차 네비게이션 (80px) */}
        <PrimaryNav
          activeId={activeNavItem?.id}
          onSelect={handleNavSelect}
        />

        {/* 2차 패널 (240px, 조건부) */}
        <SecondaryPanel activeNavItem={activeNavItem}>
          {showChatbotSelector && <ChatbotSelector />}
        </SecondaryPanel>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
