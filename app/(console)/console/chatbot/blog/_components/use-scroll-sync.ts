// app/(console)/console/chatbot/blog/_components/use-scroll-sync.ts

import { useRef, useEffect, useCallback } from 'react';

interface ScrollMapping {
  originalStart: number; // 원본 문서에서의 문자 위치
  originalEnd: number;
  reconstructedStart: number; // 재구성 문서에서의 문자 위치
  reconstructedEnd: number;
}

interface UseScrollSyncOptions {
  enabled: boolean;
  leftRef: React.RefObject<HTMLDivElement | null>;
  rightRef: React.RefObject<HTMLDivElement | null>;
  mappings?: ScrollMapping[];
  mode?: 'ratio' | 'mapping' | 'hybrid';
}

/**
 * 스크롤 동기화 훅
 *
 * 원본 ↔ 재구성 문서 간 스크롤을 동기화합니다.
 * 한쪽을 스크롤하면 다른 쪽도 해당 위치로 이동합니다.
 *
 * 동기화 모드:
 * - ratio: 스크롤 위치를 퍼센트로 환산하여 동기화 (단순)
 * - mapping: 원본↔재구성 위치 매핑 테이블 사용 (정확)
 * - hybrid: 매핑이 있으면 매핑 사용, 없으면 비율 사용
 */
export function useScrollSync({
  enabled,
  leftRef,
  rightRef,
  mappings = [],
  mode = 'hybrid',
}: UseScrollSyncOptions) {
  // 스크롤 이벤트 루프 방지용 플래그
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollSourceRef = useRef<'left' | 'right' | null>(null);

  // 최대 문자 위치 계산
  const getMaxOriginal = useCallback(
    () => Math.max(...mappings.map((m) => m.originalEnd), 1),
    [mappings]
  );

  const getMaxReconstructed = useCallback(
    () => Math.max(...mappings.map((m) => m.reconstructedEnd), 1),
    [mappings]
  );

  // 가장 가까운 매핑 찾기
  const findClosestMapping = useCallback(
    (charPosition: number, isOriginal: boolean): ScrollMapping | null => {
      if (mappings.length === 0) return null;

      return mappings.reduce((closest, current) => {
        const currentPos = isOriginal
          ? current.originalStart
          : current.reconstructedStart;
        const closestPos = isOriginal
          ? closest.originalStart
          : closest.reconstructedStart;

        return Math.abs(currentPos - charPosition) <
          Math.abs(closestPos - charPosition)
          ? current
          : closest;
      });
    },
    [mappings]
  );

  // 비율 기반 동기화
  const syncByRatio = useCallback(
    (source: HTMLDivElement, target: HTMLDivElement) => {
      const maxScroll = source.scrollHeight - source.clientHeight;
      if (maxScroll <= 0) return;

      const sourceScrollRatio = source.scrollTop / maxScroll;
      const targetMaxScroll = target.scrollHeight - target.clientHeight;
      const targetScrollTop = sourceScrollRatio * targetMaxScroll;

      target.scrollTop = targetScrollTop;
    },
    []
  );

  // 매핑 기반 동기화 (더 정확한 위치 매핑)
  const syncByMapping = useCallback(
    (
      source: HTMLDivElement,
      target: HTMLDivElement,
      isLeftToRight: boolean
    ) => {
      if (mappings.length === 0) {
        syncByRatio(source, target);
        return;
      }

      const maxScroll = source.scrollHeight - source.clientHeight;
      if (maxScroll <= 0) return;

      // 현재 스크롤 위치에 해당하는 문자 위치 추정
      const scrollRatio = source.scrollTop / maxScroll;
      const estimatedCharPosition = Math.floor(
        scrollRatio *
          (isLeftToRight ? getMaxOriginal() : getMaxReconstructed())
      );

      // 해당 위치에 가장 가까운 매핑 찾기
      const mapping = findClosestMapping(estimatedCharPosition, isLeftToRight);
      if (!mapping) {
        syncByRatio(source, target);
        return;
      }

      // 타겟 문서에서의 비율 계산
      const targetCharPosition = isLeftToRight
        ? mapping.reconstructedStart
        : mapping.originalStart;
      const targetTotal = isLeftToRight
        ? getMaxReconstructed()
        : getMaxOriginal();
      const targetRatio = targetCharPosition / targetTotal;

      const targetMaxScroll = target.scrollHeight - target.clientHeight;
      target.scrollTop = targetRatio * targetMaxScroll;
    },
    [
      mappings,
      syncByRatio,
      getMaxOriginal,
      getMaxReconstructed,
      findClosestMapping,
    ]
  );

  // 왼쪽 패널 스크롤 핸들러
  const handleLeftScroll = useCallback(() => {
    if (!enabled || isScrollingRef.current) return;
    if (!leftRef.current || !rightRef.current) return;

    // 이미 오른쪽에서 스크롤 중이면 무시
    if (lastScrollSourceRef.current === 'right') return;

    lastScrollSourceRef.current = 'left';
    isScrollingRef.current = true;

    if (mode === 'ratio') {
      syncByRatio(leftRef.current, rightRef.current);
    } else if (mode === 'mapping') {
      syncByMapping(leftRef.current, rightRef.current, true);
    } else {
      // hybrid: 매핑이 있으면 매핑 사용
      if (mappings.length > 0) {
        syncByMapping(leftRef.current, rightRef.current, true);
      } else {
        syncByRatio(leftRef.current, rightRef.current);
      }
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      lastScrollSourceRef.current = null;
    }, 150);
  }, [enabled, leftRef, rightRef, mode, mappings, syncByRatio, syncByMapping]);

  // 오른쪽 패널 스크롤 핸들러
  const handleRightScroll = useCallback(() => {
    if (!enabled || isScrollingRef.current) return;
    if (!leftRef.current || !rightRef.current) return;

    if (lastScrollSourceRef.current === 'left') return;

    lastScrollSourceRef.current = 'right';
    isScrollingRef.current = true;

    if (mode === 'ratio') {
      syncByRatio(rightRef.current, leftRef.current);
    } else if (mode === 'mapping') {
      syncByMapping(rightRef.current, leftRef.current, false);
    } else {
      if (mappings.length > 0) {
        syncByMapping(rightRef.current, leftRef.current, false);
      } else {
        syncByRatio(rightRef.current, leftRef.current);
      }
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      lastScrollSourceRef.current = null;
    }, 150);
  }, [enabled, leftRef, rightRef, mode, mappings, syncByRatio, syncByMapping]);

  // 이벤트 리스너 등록
  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;

    if (!leftEl || !rightEl || !enabled) return;

    leftEl.addEventListener('scroll', handleLeftScroll, { passive: true });
    rightEl.addEventListener('scroll', handleRightScroll, { passive: true });

    return () => {
      leftEl.removeEventListener('scroll', handleLeftScroll);
      rightEl.removeEventListener('scroll', handleRightScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [enabled, leftRef, rightRef, handleLeftScroll, handleRightScroll]);

  // 특정 위치로 양쪽 패널 스크롤
  const scrollBothToPosition = useCallback(
    (charPosition: number, isOriginal: boolean) => {
      if (!leftRef.current || !rightRef.current) return;

      const leftTotal = getMaxOriginal();
      const rightTotal = getMaxReconstructed();

      const leftRatio = isOriginal
        ? charPosition / leftTotal
        : (findClosestMapping(charPosition, false)?.originalStart || 0) /
          leftTotal;

      const rightRatio = isOriginal
        ? (findClosestMapping(charPosition, true)?.reconstructedStart || 0) /
          rightTotal
        : charPosition / rightTotal;

      const leftMaxScroll =
        leftRef.current.scrollHeight - leftRef.current.clientHeight;
      const rightMaxScroll =
        rightRef.current.scrollHeight - rightRef.current.clientHeight;

      isScrollingRef.current = true;
      leftRef.current.scrollTop = leftRatio * leftMaxScroll;
      rightRef.current.scrollTop = rightRatio * rightMaxScroll;

      setTimeout(() => {
        isScrollingRef.current = false;
      }, 200);
    },
    [leftRef, rightRef, getMaxOriginal, getMaxReconstructed, findClosestMapping]
  );

  return {
    scrollBothToPosition,
  };
}
