'use client';

import Link from 'next/link';
import { useCurrentChatbot } from '../hooks/use-console-state';
import { useAutoSave } from '../hooks/use-auto-save';
import { SaveStatusIndicator } from './save-status-indicator';
import { AppSidebar } from './nav/app-sidebar';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ExternalLink, Rocket, Command, Sofa } from 'lucide-react';

interface ConsoleShellProps {
  children: React.ReactNode;
}

/**
 * Console Shell
 *
 * shadcn/ui Sidebar-07 패턴 기반 레이아웃 셸
 *
 * 레이아웃 구조 (shadcn/ui 권장 패턴):
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │                        SidebarProvider                                   │
 * │ ┌────────────────┬─────────────────────────────────────────────────────┐ │
 * │ │                │  SidebarInset                                       │ │
 * │ │   AppSidebar   │ ┌─────────────────────────────────────────────────┐ │ │
 * │ │                │ │ [≡] | 🛋️ SOFA     저장됨        [👁] [🚀 발행] │ │ │
 * │ │ [🤖 챗봇명 ▾]  │ │         ↑ sticky header                         │ │ │
 * │ │ ─────────────  │ ├─────────────────────────────────────────────────┤ │ │
 * │ │ [📊] Dashboard │ │                                                 │ │ │
 * │ │ [📚] 지식  ▾   │ │              Main Content                       │ │ │
 * │ │ [🎨] 디자인 ▾  │ │                                                 │ │ │
 * │ │ [⚙️] 설정  ▾   │ │                                                 │ │ │
 * │ │ ──────────     │ └─────────────────────────────────────────────────┘ │ │
 * │ │ [👤] 유저메뉴  │                                                     │ │
 * │ └────────────────┴─────────────────────────────────────────────────────┘ │
 * │    240px / icon                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * 핵심:
 * - SidebarProvider가 전체를 감싸고
 * - TopBar는 SidebarInset 내부 상단에 sticky로 배치
 * - SidebarTrigger가 SidebarProvider 내부에 있어야 정상 동작
 */
export function ConsoleShell({ children }: ConsoleShellProps) {
  const { currentChatbot } = useCurrentChatbot();
  const { saveStatus, saveNow } = useAutoSave();
  const toast = useToast();

  const handlePublish = async () => {
    if (!currentChatbot) return;

    // 저장되지 않은 변경사항이 있으면 먼저 저장
    if (saveStatus === 'unsaved') {
      saveNow();
    }

    try {
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/public-page/publish`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('발행에 실패했습니다');
      }

      toast.success('발행 완료', '변경사항이 공개 페이지에 적용되었습니다.');
    } catch (error) {
      toast.error('발행 실패', '잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        {/* TopBar - SidebarInset 내부 sticky header */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
          {/* 좌측: 사이드바 토글 + 로고 */}
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          {/* 로고 */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-primary"
          >
            <Sofa className="h-5 w-5" />
            <span className="hidden sm:inline">SOFA</span>
          </Link>

          {/* 중앙: 저장 상태 (flex-1로 공간 확보 후 중앙 정렬) */}
          <div className="flex flex-1 items-center justify-center">
            <SaveStatusIndicator />
          </div>

          {/* 우측: 액션 버튼들 */}
          <div className="flex items-center gap-2">
            {/* Command Palette 버튼 (향후 구현) */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden items-center gap-1.5 text-muted-foreground sm:flex"
            >
              <Command className="h-3.5 w-3.5" />
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </Button>

            {/* 미리보기 링크 */}
            {currentChatbot?.slug && currentChatbot.publicPageEnabled && (
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href={`/${currentChatbot.slug}`}
                  target="_blank"
                  className="flex items-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">미리보기</span>
                </Link>
              </Button>
            )}

            {/* 발행 버튼 */}
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5"
            >
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">발행하기</span>
            </Button>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
