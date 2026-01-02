'use client';

/**
 * 공개 페이지 헤더 블록
 *
 * Linktree 스타일 프로필 헤더
 * - 로고 이미지 (원형)
 * - 타이틀
 * - 설명
 */

import Image from 'next/image';

interface HeaderBlockProps {
  title: string;
  description?: string;
  logoUrl?: string;
  showBrandName?: boolean;
  primaryColor: string;
}

export function HeaderBlock({
  title,
  description,
  logoUrl,
  primaryColor,
}: HeaderBlockProps) {
  return (
    <header className="mb-8 flex flex-col items-center text-center">
      {/* 로고 */}
      {logoUrl ? (
        <div
          className="mb-4 h-24 w-24 overflow-hidden rounded-full ring-4"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        >
          <Image
            src={logoUrl}
            alt={title}
            width={96}
            height={96}
            className="h-full w-full object-cover"
            priority
          />
        </div>
      ) : (
        <div
          className="mb-4 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {title.charAt(0).toUpperCase()}
        </div>
      )}

      {/* 타이틀 */}
      <h1 className="text-2xl font-bold">{title}</h1>

      {/* 설명 */}
      {description && (
        <p className="mt-2 max-w-md text-base opacity-70">{description}</p>
      )}
    </header>
  );
}
