'use client';

import { ConsoleHeader } from './components/console-header';
import { LeftSidebar } from './components/left-sidebar';
import { CenterPreview } from './components/center-preview';
import { RightSettings } from './components/right-settings';
import { useConsole } from './hooks/use-console-state';

export default function ConsolePage() {
  const { isLoading } = useConsole();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* 상단 헤더 */}
      <ConsoleHeader />

      {/* 3-컬럼 메인 영역 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 모드 탭 + 챗봇 목록 */}
        <LeftSidebar />

        {/* 중앙: 프리뷰 */}
        <CenterPreview />

        {/* 우측: 설정 패널 */}
        <RightSettings />
      </div>
    </div>
  );
}
