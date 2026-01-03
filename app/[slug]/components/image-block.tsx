'use client';

/**
 * 이미지 블록 컴포넌트
 *
 * 단일 이미지를 표시합니다.
 * - 다양한 종횡비 지원: 1:1, 4:3, 16:9, auto
 * - 캡션 표시 옵션
 * - 클릭 시 링크 이동 옵션
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ImageBlockAspectRatio } from '@/lib/public-page/block-types';

interface ImageBlockProps {
  src: string;
  alt: string;
  caption?: string;
  aspectRatio: ImageBlockAspectRatio;
  linkUrl?: string;
}

/**
 * 종횡비별 클래스 매핑
 */
const ASPECT_RATIO_CLASSES: Record<ImageBlockAspectRatio, string> = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  auto: 'aspect-auto',
};

export function ImageBlock({
  src,
  alt,
  caption,
  aspectRatio,
  linkUrl,
}: ImageBlockProps) {
  // 이미지가 없으면 플레이스홀더 표시
  const hasImage = src && src.trim() !== '';

  const imageContent = (
    <div className="overflow-hidden rounded-xl">
      <div
        className={cn(
          'relative w-full bg-muted',
          ASPECT_RATIO_CLASSES[aspectRatio],
          aspectRatio === 'auto' && 'min-h-[200px]'
        )}
      >
        {hasImage ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-muted-foreground">이미지를 추가하세요</span>
          </div>
        )}
      </div>
      {caption && (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {caption}
        </p>
      )}
    </div>
  );

  // 링크가 있으면 링크로 감싸기
  if (linkUrl && linkUrl.trim() !== '') {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-opacity hover:opacity-90"
      >
        {imageContent}
      </a>
    );
  }

  return imageContent;
}
