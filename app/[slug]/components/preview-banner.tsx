'use client';

/**
 * 미리보기 모드 상단 배너
 *
 * 배포 전 미리보기 상태임을 사용자에게 명확히 알립니다.
 * - 애니메이션 그라데이션 배경으로 임시 페이지임을 강조
 * - 닫기 버튼으로 배너만 숨기기 가능
 * - 페이지 콘텐츠와 독립적인 영역 (마진 유지)
 */

import { useState } from 'react';
import { Eye, X } from 'lucide-react';

export function PreviewBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div
      className="relative z-50 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white shadow-md"
      style={{
        background: 'linear-gradient(90deg, #f59e0b, #eab308, #f59e0b, #eab308)',
        backgroundSize: '300% 100%',
        animation: 'gradient-flow 3s linear infinite',
      }}
    >
      {/* 글로벌 스타일 주입 */}
      <style jsx global>{`
        @keyframes gradient-flow {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }
      `}</style>

      <Eye className="h-4 w-4 shrink-0" />
      <span className="drop-shadow-sm">
        배포 전 미리보기 화면입니다. 실제 방문자에게는 보이지 않습니다.
      </span>
      <button
        onClick={() => setIsVisible(false)}
        className="ml-2 shrink-0 rounded p-1 transition-colors hover:bg-white/20"
        aria-label="배너 닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
