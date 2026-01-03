'use client';

import { AppSidebar } from './nav/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AutoSaveProvider } from '../hooks/use-auto-save';
import { VersionsProvider, useVersions } from '../hooks/use-versions';

interface ConsoleShellProps {
  children: React.ReactNode;
}

/**
 * AutoSave와 Versions를 연결하는 내부 컴포넌트
 *
 * VersionsProvider 내부에서 useVersions()를 사용해
 * 저장 성공 시 버전 목록을 자동 새로고침합니다.
 */
function AutoSaveWithVersionSync({ children }: { children: React.ReactNode }) {
  const { refreshVersions } = useVersions();

  return (
    <AutoSaveProvider onSaveSuccess={refreshVersions}>
      {children}
    </AutoSaveProvider>
  );
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
 * - Sidebar는 항상 열인 상태 (축소 없음)
 * - 각 메뉴 아이템만 Collapsible (폴드 가능)
 * - AutoSave 성공 시 Versions 자동 새로고침 (발행 상태 동기화)
 */
export function ConsoleShell({ children }: ConsoleShellProps) {
  return (
    <VersionsProvider>
      <AutoSaveWithVersionSync>
        <SidebarProvider defaultOpen={true} className="!min-h-0 h-screen">
          <AppSidebar />
          <SidebarInset className="overflow-hidden">
            <main className="h-full overflow-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </AutoSaveWithVersionSync>
    </VersionsProvider>
  );
}
