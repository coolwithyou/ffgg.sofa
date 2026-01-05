'use client';

/**
 * 클래식 프로필 테마
 *
 * 기본 프로필 스타일입니다.
 * - 원형 로고 + 프라이머리 컬러 링
 * - 중앙 정렬된 타이틀과 설명
 * - 심플하고 깔끔한 디자인
 */

import type { HeaderProps } from '../types';
import {
  ProfileLogo,
  ProfileTitle,
  ProfileDescription,
  BrandBadge,
} from './shared';

export function ClassicProfile({ config, theme }: HeaderProps) {
  const { title, description, logoUrl, showBrandName } = config;
  const { primaryColor } = theme;

  return (
    <header className="mb-8 flex flex-col items-center text-center">
      <ProfileLogo
        logoUrl={logoUrl}
        title={title}
        primaryColor={primaryColor}
      />
      <ProfileTitle title={title} />
      <ProfileDescription description={description} />
      {showBrandName && <BrandBadge />}
    </header>
  );
}
