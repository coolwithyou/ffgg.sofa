'use client';

import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { PreviewContent } from './preview-content';

/**
 * 중앙 프리뷰 영역
 *
 * WYSIWYG 원칙에 따라 프리뷰 = 편집 캔버스:
 * - 사용자가 보는 화면 = 에디터에서 편집하는 화면
 * - 블록을 드래그하여 순서 변경 가능
 * - 블록 선택, 가시성 토글, 삭제 지원
 * - 테마의 외부 배경색을 전체 프리뷰 영역에 적용
 */
export function CenterPreview() {
  const { currentChatbot } = useCurrentChatbot();
  const { pageConfig } = usePageConfig();

  // 테마에서 외부 배경색 가져오기 (기본값: muted 배경)
  const backgroundColor = pageConfig?.theme?.backgroundColor;

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

  // 외부 배경색 스타일 (테마 설정 또는 기본값)
  const backgroundStyle = backgroundColor
    ? { backgroundColor }
    : undefined;

  return (
    <main
      className={`flex flex-1 flex-col ${!backgroundColor ? 'bg-muted/30' : ''}`}
      style={backgroundStyle}
    >
      {/* WYSIWYG 프리뷰 영역 - 전체 높이에 외부 배경색 적용 */}
      <div className="flex-1 overflow-y-auto">
        {/*
          PreviewContent가 PublicPageView를 렌더링
          PublicPageView 내부에서 카드 컨테이너와 마진 처리
        */}
        <PreviewContent />
      </div>
    </main>
  );
}
