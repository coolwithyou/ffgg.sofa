/**
 * 배경 스타일 유틸리티
 *
 * ThemeConfig의 backgroundType에 따라 적절한 CSS 스타일 객체를 생성합니다.
 * - solid: 단색 배경
 * - image: 배경 이미지 (+ 폴백 색상)
 * - gradient: 선형 그라데이션
 */

import type { ThemeConfig, GradientDirection } from './types';

/**
 * 그라데이션 방향 → CSS 각도 매핑
 */
const GRADIENT_DIRECTIONS: Record<GradientDirection, string> = {
  'to-b': '180deg',   // 상→하
  'to-t': '0deg',     // 하→상
  'to-r': '90deg',    // 좌→우
  'to-l': '270deg',   // 우→좌
  'to-br': '135deg',  // 좌상→우하
  'to-bl': '225deg',  // 우상→좌하
  'to-tr': '45deg',   // 좌하→우상
  'to-tl': '315deg',  // 우하→좌상
};

/**
 * ThemeConfig에서 배경 CSS 스타일 생성
 *
 * @param theme - 테마 설정
 * @returns React.CSSProperties 객체
 */
export function getBackgroundStyles(theme: ThemeConfig): React.CSSProperties {
  switch (theme.backgroundType) {
    case 'image':
      // 이미지가 있으면 배경 이미지 적용, 없으면 단색으로 폴백
      if (theme.backgroundImage) {
        return {
          backgroundColor: theme.backgroundColor, // 이미지 로딩 실패 시 폴백
          backgroundImage: `url(${theme.backgroundImage})`,
          backgroundSize: theme.backgroundSize ?? 'cover',
          backgroundRepeat: theme.backgroundRepeat ?? 'no-repeat',
          backgroundPosition: theme.backgroundPosition ?? 'center',
        };
      }
      // 이미지 URL이 없으면 단색으로 폴백
      return { backgroundColor: theme.backgroundColor };

    case 'gradient': {
      // 사용자 정의 각도가 있으면 우선, 없으면 direction 프리셋 사용
      const angle =
        theme.gradientAngle !== undefined
          ? `${theme.gradientAngle}deg`
          : GRADIENT_DIRECTIONS[theme.gradientDirection ?? 'to-br'];

      const fromColor = theme.gradientFrom ?? '#667eea';
      const toColor = theme.gradientTo ?? '#764ba2';

      return {
        background: `linear-gradient(${angle}, ${fromColor}, ${toColor})`,
      };
    }

    case 'solid':
    default:
      return { backgroundColor: theme.backgroundColor };
  }
}

/**
 * 그라데이션 방향 라벨 (UI용)
 */
export const GRADIENT_DIRECTION_LABELS: Record<GradientDirection, string> = {
  'to-b': '↓ 상→하',
  'to-t': '↑ 하→상',
  'to-r': '→ 좌→우',
  'to-l': '← 우→좌',
  'to-br': '↘ 대각선 (우하)',
  'to-bl': '↙ 대각선 (좌하)',
  'to-tr': '↗ 대각선 (우상)',
  'to-tl': '↖ 대각선 (좌상)',
};

/**
 * 그라데이션 방향 목록 (UI select용)
 */
export const GRADIENT_DIRECTION_OPTIONS: { value: GradientDirection; label: string }[] = [
  { value: 'to-br', label: '↘ 대각선 (우하)' },
  { value: 'to-b', label: '↓ 상→하' },
  { value: 'to-r', label: '→ 좌→우' },
  { value: 'to-tr', label: '↗ 대각선 (우상)' },
  { value: 'to-t', label: '↑ 하→상' },
  { value: 'to-tl', label: '↖ 대각선 (좌상)' },
  { value: 'to-l', label: '← 우→좌' },
  { value: 'to-bl', label: '↙ 대각선 (좌하)' },
];
