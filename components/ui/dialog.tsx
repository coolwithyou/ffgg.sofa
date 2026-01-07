'use client';

/**
 * 범용 다이얼로그 컴포넌트
 * 폼이나 커스텀 컨텐츠를 담을 수 있는 모달
 */

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** 다이얼로그 최대 너비 */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  /** 고정 높이 사용 여부 (true면 80vh 고정, 내부 스크롤) */
  fixedHeight?: boolean;
  /** 다이얼로그 위치: center(기본), bottom(하단에 위치하여 상단 콘텐츠 보기 가능) */
  position?: 'center' | 'bottom';
  /** 다이얼로그 최대 높이 (position='bottom'일 때 유용) */
  maxHeight?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  fixedHeight = false,
  position = 'center',
  maxHeight,
}: DialogProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 위치에 따른 컨테이너 클래스
  const positionClasses = {
    center: 'items-center justify-center',
    bottom: 'items-end justify-center pb-4',
  };

  // 높이 스타일 결정
  const getHeightStyle = () => {
    if (maxHeight) return { maxHeight };
    if (fixedHeight) return { height: '80vh' };
    return {};
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${positionClasses[position]}`}>
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 다이얼로그 */}
      <div
        className={`relative z-10 w-full ${maxWidthClasses[maxWidth]} rounded-lg border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 ${fixedHeight || maxHeight ? 'flex flex-col' : ''}`}
        style={getHeightStyle()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h2
              id="dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p
                id="dialog-description"
                className="mt-1 text-sm text-muted-foreground"
              >
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className={`mt-4 ${fixedHeight || maxHeight ? 'flex-1 overflow-y-auto min-h-0' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
