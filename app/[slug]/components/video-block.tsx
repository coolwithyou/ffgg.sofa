'use client';

/**
 * 비디오 블록 컴포넌트
 *
 * YouTube 또는 Vimeo 영상을 임베드합니다.
 * - 자동 재생 옵션
 * - 컨트롤 표시 옵션
 */

import type { VideoProvider } from '@/lib/public-page/block-types';

interface VideoBlockProps {
  provider: VideoProvider;
  videoId: string;
  autoPlay: boolean;
  showControls: boolean;
}

/**
 * 비디오 제공자별 임베드 URL 생성
 */
function getEmbedUrl(
  provider: VideoProvider,
  videoId: string,
  autoPlay: boolean,
  showControls: boolean
): string {
  const autoPlayParam = autoPlay ? 1 : 0;
  const controlsParam = showControls ? 1 : 0;

  switch (provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${videoId}?autoplay=${autoPlayParam}&controls=${controlsParam}&rel=0`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${videoId}?autoplay=${autoPlayParam}&controls=${controlsParam}`;
    default:
      return '';
  }
}

export function VideoBlock({
  provider,
  videoId,
  autoPlay,
  showControls,
}: VideoBlockProps) {
  // 비디오 ID가 없으면 플레이스홀더 표시
  if (!videoId || videoId.trim() === '') {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
        <span className="text-muted-foreground">비디오 ID를 입력하세요</span>
      </div>
    );
  }

  const embedUrl = getEmbedUrl(provider, videoId, autoPlay, showControls);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
      <iframe
        src={embedUrl}
        title="비디오 플레이어"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
