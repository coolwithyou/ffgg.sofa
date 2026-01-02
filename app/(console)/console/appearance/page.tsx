'use client';

import { CenterPreview } from '../components/center-preview';
import { RightSettings } from '../components/right-settings';
import { useConsole } from '../hooks/use-console-state';
import { useAutoSave } from '../hooks/use-auto-save';

/**
 * Appearance (Page) 에디터
 *
 * 기존 Console Editor의 메인 기능
 * 2-컬럼 레이아웃:
 * - 좌측: 디바이스 프레임 프리뷰
 * - 우측: 설정 패널
 */
export default function AppearancePage() {
  const { isLoading } = useConsole();

  // 자동 저장 훅 활성화
  useAutoSave();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 중앙: 프리뷰 */}
      <CenterPreview />

      {/* 우측: 설정 패널 */}
      <RightSettings />
    </div>
  );
}
