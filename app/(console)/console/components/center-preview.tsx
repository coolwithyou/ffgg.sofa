'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import { PreviewContent } from './preview-content';

/**
 * 중앙 프리뷰 영역
 *
 * Linktree 스타일의 실제 서비스와 동일한 레이아웃:
 * - 에디터에서 보는 화면 = 사용자가 보는 화면
 * - 전체 높이 활용, 스크롤 가능
 * - max-w-2xl (672px) 너비 제한으로 모바일/PC 동일한 경험
 */
export function CenterPreview() {
  const { currentChatbot } = useCurrentChatbot();

  if (!currentChatbot) {
    return (
      <main className="flex flex-1 items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            아직 챗봇이 없습니다
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            새 챗봇을 추가하여 시작하세요
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-muted/30">
      {/* 프리뷰 영역 - 실제 서비스와 동일한 레이아웃 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto h-full max-w-2xl">
          {/*
            프리뷰 컨테이너
            - 양쪽 여백으로 에디터 컨텍스트 구분
            - 그림자로 콘텐츠 영역 강조
            - 라운드 코너
          */}
          <div className="mx-4 my-4 min-h-[calc(100%-2rem)] overflow-hidden rounded-xl shadow-2xl">
            <PreviewContent />
          </div>
        </div>
      </div>
    </main>
  );
}
