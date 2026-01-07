'use client';

/**
 * 테마 격리 프리뷰 래퍼
 *
 * 프리뷰 영역을 시스템 다크/라이트 모드로부터 격리합니다.
 * - Console UI (사이드바, 다이얼로그 등): 시스템 테마 따름
 * - Preview 영역 (퍼블릭 페이지 미리보기): 항상 라이트 테마 기반
 *
 * 이렇게 해야 사용자가 만든 퍼블릭 페이지가 실제로 어떻게 보일지
 * 정확히 확인할 수 있습니다.
 *
 * 기술적 구현:
 * - CSS 변수를 라이트 테마 값으로 강제 오버라이드
 * - 자식 요소들은 이 변수를 상속받아 사용
 */

import { type ReactNode } from 'react';

/**
 * 라이트 테마 CSS 변수 (globals.css :root와 동일)
 *
 * 프리뷰 콘텐츠는 이 값들을 사용하여 시스템 테마와 무관하게
 * 항상 동일한 스타일로 렌더링됩니다.
 */
const LIGHT_THEME_VARS: React.CSSProperties = {
  // @ts-expect-error CSS custom properties
  '--background': 'oklch(0.99 0 0)',
  '--foreground': 'oklch(0.13 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.13 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.13 0 0)',
  '--primary': 'oklch(0.13 0 0)',
  '--primary-foreground': 'oklch(1 0 0)',
  '--secondary': 'oklch(0.96 0 0)',
  '--secondary-foreground': 'oklch(0.25 0 0)',
  '--muted': 'oklch(0.96 0 0)',
  '--muted-foreground': 'oklch(0.45 0 0)',
  '--accent': 'oklch(0.96 0 0)',
  '--accent-foreground': 'oklch(0.25 0 0)',
  '--destructive': 'oklch(0.55 0.2 25)',
  '--border': 'oklch(0.9 0 0)',
  '--input': 'oklch(0.9 0 0)',
  '--ring': 'oklch(0.13 0 0)',
  // color-scheme도 light로 강제
  colorScheme: 'light',
};

interface ThemeIsolatedPreviewProps {
  children: ReactNode;
  className?: string;
}

export function ThemeIsolatedPreview({
  children,
  className,
}: ThemeIsolatedPreviewProps) {
  return (
    <div
      className={className}
      style={LIGHT_THEME_VARS}
      // 이 영역이 테마 격리됨을 명시
      data-theme-isolated="true"
    >
      {children}
    </div>
  );
}
