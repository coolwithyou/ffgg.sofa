'use client';

/**
 * 이미지 캐러셀 블록 컴포넌트
 *
 * 여러 이미지를 슬라이드 형태로 표시합니다.
 * - 자동 재생 옵션
 * - 도트/화살표 네비게이션
 * - 이미지별 링크 지원
 */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CarouselImageItem } from '@/lib/public-page/block-types';

interface ImageCarouselBlockProps {
  images: CarouselImageItem[];
  autoPlay: boolean;
  interval: number;
  showDots: boolean;
  showArrows: boolean;
}

export function ImageCarouselBlock({
  images,
  autoPlay,
  interval,
  showDots,
  showArrows,
}: ImageCarouselBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // 다음 슬라이드로 이동
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  // 이전 슬라이드로 이동
  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // 자동 재생
  useEffect(() => {
    if (!autoPlay || images.length <= 1) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, images.length, goToNext]);

  // 이미지가 없으면 플레이스홀더 표시
  if (images.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
        <span className="text-muted-foreground">이미지를 추가하세요</span>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  const imageContent = (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
      <Image
        src={currentImage.src}
        alt={currentImage.alt}
        fill
        className="object-cover transition-opacity duration-300"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />

      {/* 화살표 네비게이션 */}
      {showArrows && images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              goToPrev();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            aria-label="이전 이미지"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              goToNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            aria-label="다음 이미지"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* 도트 네비게이션 */}
      {showDots && images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                setCurrentIndex(index);
              }}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                index === currentIndex
                  ? 'bg-white'
                  : 'bg-white/50 hover:bg-white/70'
              )}
              aria-label={`${index + 1}번 이미지로 이동`}
            />
          ))}
        </div>
      )}
    </div>
  );

  // 현재 이미지에 링크가 있으면 링크로 감싸기
  if (currentImage.linkUrl && currentImage.linkUrl.trim() !== '') {
    return (
      <a
        href={currentImage.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {imageContent}
      </a>
    );
  }

  return imageContent;
}
