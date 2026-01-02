'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import { DeviceFrame } from './device-frame';
import { PreviewContent } from './preview-content';

/**
 * 중앙 프리뷰 영역
 *
 * 현재 선택된 챗봇의 디바이스 프리뷰를 표시합니다.
 * - 충분한 패딩으로 shadow 효과 확보
 * - 세로 중앙 정렬로 상하 영역 균등 배치
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
    <main className="flex flex-1 flex-col items-center justify-center bg-muted/30">
      {/*
        DeviceFrame 주위에 충분한 여백 확보
        - p-12: shadow-2xl이 잘리지 않도록 48px 패딩
        - min-h-0: flex 컨테이너에서 스크롤 가능하도록
      */}
      <div className="flex min-h-0 items-center justify-center p-12">
        <DeviceFrame>
          <PreviewContent />
        </DeviceFrame>
      </div>

      {/* 현재 챗봇 정보 */}
      <div className="pb-4 text-center">
        <span className="text-sm font-medium text-foreground">
          {currentChatbot.name}
        </span>
        {currentChatbot.slug && (
          <span className="ml-2 text-xs text-muted-foreground">
            /{currentChatbot.slug}
          </span>
        )}
      </div>
    </main>
  );
}
