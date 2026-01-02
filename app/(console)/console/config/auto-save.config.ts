/**
 * 자동 저장 설정
 *
 * 환경변수 또는 기본값으로 debounce 시간 및 재시도 설정을 관리합니다.
 * 테스트 환경에서는 더 짧은 시간, 프로덕션에서는 안정적인 시간을 사용합니다.
 */

export const AUTO_SAVE_CONFIG = {
  /**
   * Debounce 딜레이 (ms)
   *
   * 사용자 입력 후 저장 API 호출까지 대기 시간
   * - 300ms: 빠른 반응, API 호출 잦음
   * - 500ms: 권장 기본값 (균형)
   * - 1000ms: 타이핑 완료 후 저장, 느린 피드백
   */
  debounceDelay: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE ?? '500',
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
} as const;

export type AutoSaveConfig = typeof AUTO_SAVE_CONFIG;

/**
 * 환경별 권장 설정
 *
 * .env.local:
 *   NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE=500
 *   NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=3000
 *   NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=3
 *   NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=true
 *
 * .env.test:
 *   NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE=100
 *   NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=500
 *   NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=1
 *   NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=false
 */
