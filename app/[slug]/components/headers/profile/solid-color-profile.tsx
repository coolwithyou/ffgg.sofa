'use client';

/**
 * 솔리드 컬러 프로필 테마
 *
 * 단색 배경에 원형 프로필 스타일입니다.
 * - 커스텀 배경색 (프라이머리 컬러 활용)
 * - 흰색 텍스트로 대비
 * - 원형 로고에 흰색 테두리
 * - 강렬하고 브랜드 중심적인 인상
 */

import type { HeaderProps } from '../types';
import {
  ProfileLogo,
  ProfileTitle,
  ProfileDescription,
  BrandBadge,
  ProfileGradientZone,
} from './shared';

export function SolidColorProfile({ config, theme }: HeaderProps) {
  const { title, description, logoUrl, showBrandName, headerBackgroundColor } =
    config;
  const { primaryColor } = theme;

  // 헤더 전용 배경색 우선, 없으면 테마 primaryColor 사용
  const backgroundColor = headerBackgroundColor || primaryColor;

  return (
    <header
      className="relative mb-8 flex flex-col items-center rounded-t-2xl p-8 text-center text-white"
      style={{ backgroundColor }}
    >
      <ProfileLogo
        logoUrl={logoUrl}
        title={title}
        primaryColor={primaryColor}
        size="lg"
        ringColor="rgba(255, 255, 255, 0.8)"
      />
      <ProfileTitle
        title={title}
        className="text-white"
      />
      <ProfileDescription
        description={description}
        className="text-white/80"
      />
      {showBrandName && <BrandBadge variant="light" />}

      {/* 헤더 하단 그라데이션 존 */}
      <ProfileGradientZone />
    </header>
  );
}
