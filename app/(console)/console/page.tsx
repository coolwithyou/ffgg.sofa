'use client';

import { ConsoleHeader } from './components/console-header';
import { LeftSidebar } from './components/left-sidebar';
import { CenterPreview } from './components/center-preview';
import { RightSettings } from './components/right-settings';
import { useConsole } from './hooks/use-console-state';
import { useAutoSave } from './hooks/use-auto-save';

/**
 * 콘솔 메인 페이지
 *
 * 3-컬럼 레이아웃:
 * - 좌측: 모드 탭 + 챗봇 목록
 * - 중앙: 디바이스 프레임 프리뷰
 * - 우측: 설정 패널
 */
export default function ConsolePage() {
  const { isLoading } = useConsole();

  // 자동 저장 훅 활성화
  useAutoSave();

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
