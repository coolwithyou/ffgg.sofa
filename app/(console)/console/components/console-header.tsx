'use client';

import Link from 'next/link';
import { SaveStatusIndicator } from './save-status-indicator';

/**
 * 콘솔 헤더
 *
 * 좌측: 로고
 * 중앙: 저장 상태
 * 우측: (발행 UI는 우측 사이드바로 이동)
 */
export function ConsoleHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xl font-bold text-primary">
          SOFA
        </Link>
        <span className="text-sm text-muted-foreground">Console Editor</span>
      </div>

      {/* 중앙: 저장 상태 */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <SaveStatusIndicator />
      </div>

      {/* 우측: 빈 공간 (발행 UI는 사이드바로 이동) */}
      <div className="w-24" />
    </header>
  );
}
