'use client';

/**
 * 드래그 가능한 패널을 위한 커스텀 훅
 *
 * Window-level 이벤트를 사용하여 빠른 마우스 이동에도 안정적으로 추적하며,
 * localStorage에 위치를 저장하여 사용자가 마지막으로 배치한 위치를 기억합니다.
 *
 * @example
 * ```tsx
 * const { position, isDragging, dragHandleProps } = useDraggablePanel({
 *   storageKey: 'block-settings-panel',
 * });
 *
 * return (
 *   <div style={{ left: position.x, top: position.y }}>
 *     <div {...dragHandleProps}>드래그 핸들</div>
 *   </div>
 * );
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface PanelPosition {
  x: number;
  y: number;
}

interface UseDraggablePanelOptions {
  /** localStorage 저장 키 */
  storageKey?: string;
  /** 저장된 위치가 없을 때 사용할 기본 위치 */
  defaultPosition?: PanelPosition;
  /** 패널 크기 (경계 제한에 사용) */
  panelSize?: { width: number; height: number };
}

interface UseDraggablePanelReturn {
  /** 현재 패널 위치 */
  position: PanelPosition;
  /** 드래그 중 여부 */
  isDragging: boolean;
  /** 드래그 핸들에 적용할 props */
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    style: React.CSSProperties;
  };
  /** 위치 수동 설정 */
  setPosition: (pos: PanelPosition) => void;
  /** 저장된 위치로 리셋 */
  resetPosition: () => void;
}

const DEFAULT_STORAGE_KEY = 'floating-panel-position';

/**
 * 위치를 뷰포트 경계 내로 제한
 */
function clampPosition(
  pos: PanelPosition,
  panelSize: { width: number; height: number }
): PanelPosition {
  // 서버 사이드 렌더링 대응
  if (typeof window === 'undefined') {
    return pos;
  }

  const maxX = window.innerWidth - panelSize.width;
  const maxY = window.innerHeight - panelSize.height;

  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  };
}

/**
 * localStorage에서 저장된 위치 로드
 */
function loadPosition(storageKey: string): PanelPosition | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch {
    // JSON 파싱 실패 시 무시
  }
  return null;
}

/**
 * localStorage에 위치 저장
 */
function savePosition(storageKey: string, position: PanelPosition): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(position));
  } catch {
    // 저장 실패 시 무시 (localStorage 용량 초과 등)
  }
}

/**
 * 기본 위치 계산 (우측 중앙 부근)
 */
function getDefaultPosition(panelSize: { width: number; height: number }): PanelPosition {
  if (typeof window === 'undefined') {
    return { x: 100, y: 100 };
  }

  // RightSettings 패널(w-80 = 320px)과 겹치지 않도록 위치 계산
  const rightPanelWidth = 320;
  const margin = 20;

  return {
    x: Math.max(100, window.innerWidth - panelSize.width - rightPanelWidth - margin),
    y: 100,
  };
}

export function useDraggablePanel(
  options: UseDraggablePanelOptions = {}
): UseDraggablePanelReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    defaultPosition,
    panelSize = { width: 400, height: 500 },
  } = options;

  // 초기 위치: localStorage → 사용자 지정 기본값 → 계산된 기본값
  const [position, setPositionState] = useState<PanelPosition>(() => {
    const saved = loadPosition(storageKey);
    if (saved) {
      return clampPosition(saved, panelSize);
    }
    return defaultPosition ?? getDefaultPosition(panelSize);
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef<PanelPosition>({ x: 0, y: 0 });
  const currentPosition = useRef<PanelPosition>(position);

  // position 변경 시 ref 동기화
  useEffect(() => {
    currentPosition.current = position;
  }, [position]);

  // 윈도우 리사이즈 시 경계 내로 재조정
  useEffect(() => {
    const handleResize = () => {
      setPositionState((prev) => clampPosition(prev, panelSize));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [panelSize]);

  // 마우스 드래그 시작 핸들러
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 좌클릭만 처리
      if (e.button !== 0) return;

      setIsDragging(true);

      // 드래그 시작 시 마우스와 패널 간의 오프셋 저장
      dragStartOffset.current = {
        x: e.clientX - currentPosition.current.x,
        y: e.clientY - currentPosition.current.y,
      };

      // 텍스트 선택 방지
      e.preventDefault();
    },
    []
  );

  // 터치 드래그 시작 핸들러
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      setIsDragging(true);

      dragStartOffset.current = {
        x: touch.clientX - currentPosition.current.x,
        y: touch.clientY - currentPosition.current.y,
      };
    },
    []
  );

  // 드래그 중 이동 처리 (window 레벨에서 처리하여 빠른 마우스 이동에도 대응)
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = clampPosition(
        {
          x: e.clientX - dragStartOffset.current.x,
          y: e.clientY - dragStartOffset.current.y,
        },
        panelSize
      );

      // ref로 직접 업데이트하여 리렌더링 최소화
      currentPosition.current = newPosition;
      setPositionState(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // 드래그 종료 시 위치 저장
      savePosition(storageKey, currentPosition.current);
    };

    // window 레벨에서 이벤트 처리 (요소 밖으로 마우스가 나가도 추적 가능)
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, panelSize, storageKey]);

  // 터치 이벤트 처리
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      const newPosition = clampPosition(
        {
          x: touch.clientX - dragStartOffset.current.x,
          y: touch.clientY - dragStartOffset.current.y,
        },
        panelSize
      );

      currentPosition.current = newPosition;
      setPositionState(newPosition);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      savePosition(storageKey, currentPosition.current);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, panelSize, storageKey]);

  const setPosition = useCallback(
    (pos: PanelPosition) => {
      const clamped = clampPosition(pos, panelSize);
      setPositionState(clamped);
      savePosition(storageKey, clamped);
    },
    [panelSize, storageKey]
  );

  const resetPosition = useCallback(() => {
    const newPos = defaultPosition ?? getDefaultPosition(panelSize);
    setPositionState(newPos);
    savePosition(storageKey, newPos);
  }, [defaultPosition, panelSize, storageKey]);

  return {
    position,
    isDragging,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none', // 터치 스크롤 방지
        userSelect: 'none', // 텍스트 선택 방지
      } as React.CSSProperties,
    },
    setPosition,
    resetPosition,
  };
}
