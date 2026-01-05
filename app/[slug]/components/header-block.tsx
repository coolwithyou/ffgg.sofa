'use client';

/**
 * 공개 페이지 헤더 블록
 *
 * 템플릿에 따라 적절한 헤더 컴포넌트를 렌더링합니다.
 * - profile: 기존 Linktree 스타일 프로필 헤더
 * - floating-glass: 글래스모피즘 효과의 모던 헤더
 * - minimal-sticky: 미니멀 스타일 헤더
 * - pill-nav: Pill 스타일 네비게이션 헤더
 */

import type { HeaderBlock } from '@/lib/public-page/block-types';
import type { ThemeConfig } from '@/lib/public-page/types';
import { HeaderTemplate } from '@/lib/public-page/header-templates';
import {
  ProfileHeader,
  FloatingGlassHeader,
  MinimalStickyHeader,
  PillNavHeader,
} from './headers';

interface HeaderBlockProps {
  config: HeaderBlock['config'];
  theme: ThemeConfig;
}

export function HeaderBlockRenderer({ config, theme }: HeaderBlockProps) {
  // 템플릿이 없으면 기본값 'profile' 사용 (하위호환성)
  const template = config.template || HeaderTemplate.PROFILE;

  switch (template) {
    case HeaderTemplate.FLOATING_GLASS:
      return <FloatingGlassHeader config={config} theme={theme} />;

    case HeaderTemplate.MINIMAL_STICKY:
      return <MinimalStickyHeader config={config} theme={theme} />;

    case HeaderTemplate.PILL_NAV:
      return <PillNavHeader config={config} theme={theme} />;

    case HeaderTemplate.PROFILE:
    default:
      return <ProfileHeader config={config} theme={theme} />;
  }
}

// 기존 HeaderBlock 컴포넌트와의 호환성을 위한 re-export
// TODO: 기존 사용처를 HeaderBlockRenderer로 마이그레이션 후 제거
export { HeaderBlockRenderer as HeaderBlock };
