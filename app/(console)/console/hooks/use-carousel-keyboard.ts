'use client';

import { useEffect, useCallback } from 'react';

interface UseCarouselKeyboardOptions {
  currentIndex: number;
  totalItems: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onSelectIndex: (index: number) => void;
  isEnabled?: boolean;
}

/**
 * 캐러셀 키보드 네비게이션 훅
 *
 * 지원 키:
 * - 좌/우 화살표: 이전/다음
 * - Home/End: 처음/마지막
 * - 1-9: 직접 인덱스 이동
 */
export function useCarouselKeyboard({
  currentIndex,
  totalItems,
  onNavigate,
  onSelectIndex,
  isEnabled = true,
}: UseCarouselKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 입력 필드에서는 비활성화
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            onNavigate('prev');
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < totalItems - 1) {
            onNavigate('next');
          }
          break;

        case 'Home':
          e.preventDefault();
          onSelectIndex(0);
          break;

        case 'End':
          e.preventDefault();
          onSelectIndex(totalItems - 1);
          break;

        // 숫자 키로 직접 이동 (1-9)
        default:
          if (/^[1-9]$/.test(e.key)) {
            const targetIndex = parseInt(e.key, 10) - 1;
            if (targetIndex < totalItems) {
              e.preventDefault();
              onSelectIndex(targetIndex);
            }
          }
          break;
      }
    },
    [currentIndex, totalItems, onNavigate, onSelectIndex]
  );

  useEffect(() => {
    if (!isEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, isEnabled]);
}
