/**
 * 헤더 컴포넌트 공통 타입
 */

import type { HeaderBlock } from '@/lib/public-page/block-types';
import type { ThemeConfig } from '@/lib/public-page/types';

/**
 * 헤더 컴포넌트 공통 Props
 */
export interface HeaderProps {
  /** 헤더 블록 설정 */
  config: HeaderBlock['config'];
  /** 테마 설정 */
  theme: ThemeConfig;
}
