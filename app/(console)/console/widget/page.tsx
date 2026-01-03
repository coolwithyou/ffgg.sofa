'use client';

import { WidgetPreview } from '../components/widget-preview';
import { WidgetSettings } from '../components/widget-settings';
import { useConsole } from '../hooks/use-console-state';
import { useWidgetAutoSave } from '../hooks/use-widget-auto-save';

/**
 * Widget 에디터
 *
 * 기존 사이트에 삽입되는 채팅 위젯 디자인 편집
 * 2-컬럼 레이아웃:
 * - 좌측: 심플 목업 사이트 + 위젯 프리뷰
 * - 우측: 위젯 설정 패널
 */
export default function WidgetPage() {
  const { isLoading, currentChatbot } = useConsole();

  // 자동 저장 훅 활성화
  useWidgetAutoSave();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!currentChatbot) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">챗봇을 선택해주세요</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 좌측: 위젯 프리뷰 (심플 목업 사이트 배경) */}
      <WidgetPreview />

      {/* 우측: 설정 패널 */}
      <WidgetSettings />
    </div>
  );
}
