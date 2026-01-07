'use client';

/**
 * 히어로 이미지 프로필 테마
 *
 * 풀스크린 배경 이미지 + 오버레이 스타일입니다.
 * - 배경 이미지 (heroImageUrl 또는 theme.backgroundImage)
 * - 반투명 오버레이로 텍스트 가독성 확보
 * - 흰색 텍스트로 임팩트 있는 비주얼
 * - 최소 높이 설정 가능
 */

import Image from 'next/image';
import type { HeaderProps } from '../types';
import {
  ProfileLogo,
  ProfileTitle,
  ProfileDescription,
  BrandBadge,
  ProfileGradientZone,
} from './shared';

export function HeroImageProfile({ config, theme }: HeaderProps) {
  const {
    title,
    description,
    logoUrl,
    showBrandName,
    heroImageUrl,
    heroOverlayOpacity = 40,
    heroMinHeight = '300px',
  } = config;
  const { primaryColor, backgroundImage } = theme;

  // heroImageUrl 우선, 없으면 theme.backgroundImage 사용
  const bgImage = heroImageUrl || backgroundImage;

  // 카드 상단에 fixed로 배치되므로 둥근 모서리 불필요
  // 부모 카드의 overflow: hidden과 border-radius가 적용됨
  return (
    <header
      className="relative mb-4 overflow-hidden"
      style={{ minHeight: heroMinHeight }}
    >
      {/* 배경 이미지 */}
      {bgImage && (
        <Image
          src={bgImage}
          alt=""
          fill
          className="object-cover"
          priority
        />
      )}

      {/* 배경 이미지 없을 때 그라디언트 폴백 */}
      {!bgImage && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
          }}
        />
      )}

      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: heroOverlayOpacity / 100 }}
      />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center p-8 text-center text-white">
        <ProfileLogo
          logoUrl={logoUrl}
          title={title}
          primaryColor={primaryColor}
          size="lg"
          ringColor="rgba(255, 255, 255, 0.8)"
        />
        <ProfileTitle
          title={title}
          className="text-3xl font-bold text-white drop-shadow-lg"
        />
        <ProfileDescription
          description={description}
          className="text-white/90 drop-shadow"
        />
        {showBrandName && <BrandBadge variant="light" />}
      </div>

      {/* 헤더 하단 그라데이션 존 */}
      <ProfileGradientZone />
    </header>
  );
}
