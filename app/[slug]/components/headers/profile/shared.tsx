'use client';

/**
 * 프로필 테마 공통 컴포넌트
 *
 * 모든 프로필 테마에서 재사용되는 UI 요소들입니다.
 * - ProfileLogo: 원형 로고 또는 이니셜
 * - ProfileTitle: 타이틀 텍스트
 * - ProfileDescription: 설명 텍스트
 * - BrandBadge: "Powered by SOFA" 배지
 * - ProfileGradientZone: 헤더 하단 그라데이션 존
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

// ============================================
// 프로필 로고
// ============================================

interface ProfileLogoProps {
  /** 로고 이미지 URL */
  logoUrl?: string;
  /** 타이틀 (이니셜 표시용) */
  title?: string;
  /** 프라이머리 컬러 */
  primaryColor: string;
  /** 로고 크기 */
  size?: 'md' | 'lg';
  /** 테두리 색상 */
  ringColor?: string;
  /** 추가 클래스 */
  className?: string;
}

export function ProfileLogo({
  logoUrl,
  title,
  primaryColor,
  size = 'md',
  ringColor,
  className,
}: ProfileLogoProps) {
  const sizeClasses = size === 'lg' ? 'h-28 w-28' : 'h-24 w-24';
  const imgSize = size === 'lg' ? 112 : 96;
  const fontSize = size === 'lg' ? 'text-4xl' : 'text-3xl';

  // 로고 이미지가 있는 경우
  if (logoUrl) {
    return (
      <div
        className={cn(
          sizeClasses,
          'mx-auto mb-4 overflow-hidden rounded-full ring-4',
          className
        )}
        style={{
          '--tw-ring-color': ringColor || primaryColor,
        } as React.CSSProperties}
      >
        <Image
          src={logoUrl}
          alt={title || 'Profile'}
          width={imgSize}
          height={imgSize}
          className="h-full w-full object-cover"
          priority
        />
      </div>
    );
  }

  // 이니셜 표시 (로고 없을 때)
  if (title) {
    return (
      <div
        className={cn(
          sizeClasses,
          'mx-auto mb-4 flex items-center justify-center rounded-full font-bold text-white',
          fontSize,
          className
        )}
        style={{ backgroundColor: primaryColor }}
      >
        {title.charAt(0).toUpperCase()}
      </div>
    );
  }

  // 기본 플레이스홀더
  return (
    <div
      className={cn(
        sizeClasses,
        'mx-auto mb-4 flex items-center justify-center rounded-full font-bold text-white',
        fontSize,
        className
      )}
      style={{ backgroundColor: primaryColor }}
    >
      S
    </div>
  );
}

// ============================================
// 프로필 타이틀
// ============================================

interface ProfileTitleProps {
  /** 타이틀 텍스트 */
  title?: string;
  /** 추가 클래스 */
  className?: string;
}

export function ProfileTitle({ title, className }: ProfileTitleProps) {
  if (!title) return null;

  return (
    <h1 className={cn('text-2xl font-bold', className)}>
      {title}
    </h1>
  );
}

// ============================================
// 프로필 설명
// ============================================

interface ProfileDescriptionProps {
  /** 설명 텍스트 */
  description?: string;
  /** 추가 클래스 */
  className?: string;
}

export function ProfileDescription({
  description,
  className,
}: ProfileDescriptionProps) {
  if (!description) return null;

  return (
    <p className={cn('mt-2 max-w-md text-base opacity-70', className)}>
      {description}
    </p>
  );
}

// ============================================
// 브랜드 배지
// ============================================

interface BrandBadgeProps {
  /** 배지 스타일 변형 */
  variant?: 'default' | 'light';
  /** 추가 클래스 */
  className?: string;
}

export function BrandBadge({ variant = 'default', className }: BrandBadgeProps) {
  return (
    <div
      className={cn(
        'mt-4 text-xs',
        variant === 'light' ? 'text-white/60' : 'text-muted-foreground',
        className
      )}
    >
      Powered by{' '}
      <span className="font-semibold">SOFA</span>
    </div>
  );
}

// ============================================
// 프로필 그라데이션 존
// ============================================

/**
 * 프로필 헤더 하단 그라데이션 존
 *
 * 카드 배경색에서 투명으로 변하는 그라데이션으로
 * 헤더와 카드 콘텐츠 사이의 시각적 연속성을 제공합니다.
 *
 * 최적화:
 * - 높이 40%: 자연스러운 전환을 위한 충분한 영역
 * - OKLCH 색공간: 인간 시각에 가까운 보간으로 회색 밴드 방지
 * - Eased 정지점: ease-out 곡선을 흉내내어 부드러운 전환
 */
export function ProfileGradientZone() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]"
      style={{
        background: `linear-gradient(
          to top,
          var(--card) 0%,
          color-mix(in oklch, var(--card) 80%, transparent) 20%,
          color-mix(in oklch, var(--card) 50%, transparent) 50%,
          color-mix(in oklch, var(--card) 15%, transparent) 80%,
          transparent 100%
        )`,
      }}
    />
  );
}
