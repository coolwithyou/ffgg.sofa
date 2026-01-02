'use client';

import { AppSidebar } from './nav/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

interface ConsoleShellProps {
  children: React.ReactNode;
}

/**
 * Console Shell
 *
 * 레이아웃 구조:
 * ┌──────────────┬──────────────────────────────────────────────┐
 * │ Sidebar      │                                              │
 * │ (항상 열림)  │                                              │
 * │              │                                              │
 * │ 🛋️ SOFA     │           메인 콘텐츠                        │
 * │ ──────────   │                                              │
 * │ 챗봇스위처   │                                              │
 * │ ──────────   │                                              │
 * │ 메뉴 (폴더블)│                                              │
 * │ ──────────   │                                              │
 * │ 유저메뉴     │                                              │
 * └──────────────┴──────────────────────────────────────────────┘
 *
 * 핵심:
 * - TopBar 없음, 로고는 사이드바 상단에 배치
 * - Sidebar는 항상 열린 상태 (축소 없음)
 * - 각 메뉴 아이템만 Collapsible (폴드 가능)
 */
export function ConsoleShell({ children }: ConsoleShellProps) {
  return (
    <SidebarProvider defaultOpen={true} className="!min-h-0 h-screen">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <main className="h-full overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
