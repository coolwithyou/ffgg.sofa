/**
 * 티어 시스템 타입 정의
 *
 * @module lib/tier/types
 */

import type { Tier } from './constants';

/**
 * 테넌트 설정 (tenants.settings JSONB 컬럼 스키마)
 *
 * 고급 데이터 관리 모드 등 테넌트별 설정을 저장합니다.
 */
export interface TenantSettings {
  /**
   * 고급 데이터 관리 모드 활성화 여부
   *
   * - false (기본값): 단일 데이터셋 모드 (데이터셋 메뉴 숨김, 자동 관리)
   * - true: 다중 데이터셋 모드 (데이터셋 메뉴 표시, 수동 관리)
   *
   * Premium 티어만 true로 설정 가능
   */
  advancedDatasetMode?: boolean;
}

/**
 * 테넌트 정보 (티어 + 설정)
 */
export interface TenantInfo {
  tier: Tier;
  settings: TenantSettings;
}

/**
 * 고급 모드 활성화 가능 여부 확인
 * business 티어만 활성화 가능
 */
export function canEnableAdvancedMode(tier: Tier): boolean {
  return tier === 'business';
}

/**
 * 기본 TenantSettings 값
 */
export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  advancedDatasetMode: false,
};
