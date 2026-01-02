'use client';

import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';

export function CenterPreview() {
  const { currentChatbot } = useCurrentChatbot();
  const { pageConfig } = usePageConfig();

  if (!currentChatbot) {
    return (
      <main className="flex flex-1 items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">챗봇을 선택해주세요</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8">
      {/* Phase 2에서 디바이스 프레임 + 프리뷰 추가 */}
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">
          {currentChatbot.name}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          프리뷰 영역 (Phase 2에서 구현)
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          배경색: {pageConfig.theme.backgroundColor}
        </p>
      </div>
    </main>
  );
}
