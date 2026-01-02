'use client';

import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';

export function RightSettings() {
  const { mode } = useConsoleMode();
  const { currentChatbot } = useCurrentChatbot();

  if (!currentChatbot) {
    return (
      <aside className="flex w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 overflow-y-auto border-l border-border bg-card">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {mode === 'page' ? '페이지 설정' : '위젯 설정'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentChatbot.name}의 {mode === 'page' ? '공개 페이지' : '위젯'}을
          커스터마이징하세요.
        </p>

        {/* Phase 3에서 설정 폼 추가 */}
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">
              설정 패널 (Phase 3에서 구현)
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
