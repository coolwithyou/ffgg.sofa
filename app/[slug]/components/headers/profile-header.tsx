'use client';

/**
 * 프로필 헤더 라우터
 *
 * profileTheme 설정에 따라 적절한 프로필 테마 컴포넌트를 렌더링합니다.
 * - CLASSIC: 기본 프로필 스타일
 * - SOLID_COLOR: 단색 배경 + 원형 프로필
 * - HERO_IMAGE: 풀스크린 배경 이미지 + 오버레이
 */

import { ProfileTheme } from '@/lib/public-page/header-templates';
import type { HeaderProps } from './types';
import {
  ClassicProfile,
  SolidColorProfile,
  HeroImageProfile,
} from './profile';

export function ProfileHeader({ config, theme }: HeaderProps) {
  const profileTheme = config.profileTheme || ProfileTheme.CLASSIC;

  switch (profileTheme) {
    case ProfileTheme.SOLID_COLOR:
      return <SolidColorProfile config={config} theme={theme} />;
    case ProfileTheme.HERO_IMAGE:
      return <HeroImageProfile config={config} theme={theme} />;
    case ProfileTheme.CLASSIC:
    default:
      return <ClassicProfile config={config} theme={theme} />;
  }
}
