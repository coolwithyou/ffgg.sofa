'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import { PreviewContent } from './preview-content';

/**
 * 중앙 프리뷰 영역
 *
 * WYSIWYG 원칙에 따라 프리뷰 = 편집 캔버스:
 * - 사용자가 보는 화면 = 에디터에서 편집하는 화면
 * - 블록을 드래그하여 순서 변경 가능
 * - 블록 선택, 가시성 토글, 삭제 지원
 * - max-w-2xl (672px) 너비 제한
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
      {/* WYSIWYG 프리뷰 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto h-full max-w-2xl">
          {/*
            프리뷰 컨테이너
            - 양쪽 여백으로 에디터 컨텍스트 구분
            - 그림자로 콘텐츠 영역 강조
            - 라운드 코너
          */}
          <div className="mx-4 my-4 min-h-[calc(100%-2rem)] overflow-hidden rounded-xl shadow-2xl">
            {/*
              WYSIWYG 편집 가능한 프리뷰
              PreviewContent에서 isEditing=true로 PublicPageView 렌더링
            */}
            <PreviewContent />
          </div>
        </div>
      </div>
    </main>
  );
}
