/**
 * 자동 저장 설정
 *
 * Idle 기반 자동 저장 전략:
 * - 사용자가 일정 시간 동안 변경하지 않으면 저장 실행
 * - 최소 저장 간격으로 과도한 API 호출 방지
 * - 자동 저장 비활성화 옵션 제공
 */

export const AUTO_SAVE_CONFIG = {
  /**
   * Idle 저장 딜레이 (ms)
   *
   * 마지막 변경 후 저장 대기 시간
   * - 1000ms: 빠른 저장
   * - 1500ms: 권장 기본값 (색상 드래그 등 연속 작업에 적합)
   * - 2000ms: 더 느린 저장
   */
  idleDelay: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_IDLE_DELAY ?? '1500',
    10
  ),

  /**
   * 최소 저장 간격 (ms)
   *
   * 연속 저장 방지를 위한 throttle 시간
   * - 2000ms: 빠른 피드백
   * - 3000ms: 권장 기본값
   * - 5000ms: 보수적인 저장
   */
  minSaveInterval: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_MIN_INTERVAL ?? '3000',
    10
  ),

  /**
   * 저장 실패 시 재시도 딜레이 (ms)
   */
  retryDelay: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY ?? '3000',
    10
  ),

  /**
   * 최대 재시도 횟수
   */
  maxRetries: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES ?? '3',
    10
  ),

  /**
   * 자동 재시도 활성화 여부
   */
  autoRetry: process.env.NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY !== 'false',

  /**
   * 자동 저장 기본 활성화 여부
   * (사용자가 토글로 변경 가능)
   */
  defaultAutoSaveEnabled:
    process.env.NEXT_PUBLIC_AUTO_SAVE_DEFAULT_ENABLED !== 'false',
} as const;

export type AutoSaveConfig = typeof AUTO_SAVE_CONFIG;

/**
 * 환경별 권장 설정
 *
 * .env.local:
 *   NEXT_PUBLIC_AUTO_SAVE_IDLE_DELAY=1500
 *   NEXT_PUBLIC_AUTO_SAVE_MIN_INTERVAL=3000
 *   NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=3000
 *   NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=3
 *   NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=true
 *   NEXT_PUBLIC_AUTO_SAVE_DEFAULT_ENABLED=false  # 기본 수동 저장
 *
 * .env.test:
 *   NEXT_PUBLIC_AUTO_SAVE_IDLE_DELAY=100
 *   NEXT_PUBLIC_AUTO_SAVE_MIN_INTERVAL=200
 *   NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=500
 *   NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=1
 *   NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=false
 *   NEXT_PUBLIC_AUTO_SAVE_DEFAULT_ENABLED=true
 */
