'use client';

/**
 * 플레이스홀더 블록
 *
 * MVP 테스트용 블록입니다.
 * 추후 LinkBlock, SocialBlock 등으로 대체됩니다.
 */

import { Puzzle } from 'lucide-react';

export function PlaceholderBlock() {
  return (
    <div className="rounded-xl border border-dashed border-current/20 bg-current/5 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-current/10">
        <Puzzle className="h-6 w-6 opacity-50" />
      </div>
      <p className="text-sm font-medium opacity-70">플레이스홀더 블록</p>
      <p className="mt-1 text-xs opacity-50">
        추후 링크, 소셜, 이미지 등으로 대체됩니다
      </p>
    </div>
  );
}
