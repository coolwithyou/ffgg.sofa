/**
 * 숫자 포맷팅 유틸리티
 * 토큰 사용량, 비용 등을 사람이 읽기 쉬운 형태로 변환합니다.
 */

/**
 * 큰 숫자를 K/M/B 약어로 포맷팅
 * @example
 * formatCompactNumber(999) // "999"
 * formatCompactNumber(1234) // "1.2K"
 * formatCompactNumber(1234567) // "1.23M"
 * formatCompactNumber(1234567890) // "1.23B"
 */
export function formatCompactNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    // 10억 이상: B (Billion)
    const formatted = absValue / 1_000_000_000;
    return `${sign}${formatted >= 100 ? Math.round(formatted) : formatted.toFixed(formatted >= 10 ? 1 : 2)}B`;
  }

  if (absValue >= 1_000_000) {
    // 백만 이상: M (Million)
    const formatted = absValue / 1_000_000;
    return `${sign}${formatted >= 100 ? Math.round(formatted) : formatted.toFixed(formatted >= 10 ? 1 : 2)}M`;
  }

  if (absValue >= 1_000) {
    // 천 이상: K (Thousand)
    const formatted = absValue / 1_000;
    return `${sign}${formatted >= 100 ? Math.round(formatted) : formatted.toFixed(formatted >= 10 ? 1 : 2)}K`;
  }

  // 천 미만: 그대로 (콤마 포함)
  return formatWithCommas(value);
}

/**
 * 토큰 수를 포맷팅 (K/M/B 약어 + "토큰" 접미사)
 * @example
 * formatTokenCount(1234567) // "1.23M 토큰"
 */
export function formatTokenCount(value: number, suffix = '토큰'): string {
  return `${formatCompactNumber(value)} ${suffix}`;
}

/**
 * 숫자에 세 자리마다 콤마 추가
 * @example
 * formatWithCommas(1234567) // "1,234,567"
 */
export function formatWithCommas(value: number): string {
  return value.toLocaleString('ko-KR');
}

/**
 * USD 통화 포맷팅
 * @example
 * formatCurrency(12.345) // "$12.35"
 * formatCurrency(12.345, 4) // "$12.3450"
 */
export function formatCurrency(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

/**
 * 정확한 숫자와 약어를 함께 제공 (툴팁용)
 * @example
 * getNumberWithTooltip(1234567) // { display: "1.23M", exact: "1,234,567" }
 */
export function getNumberWithTooltip(value: number): { display: string; exact: string } {
  return {
    display: formatCompactNumber(value),
    exact: formatWithCommas(value),
  };
}

/**
 * 퍼센트 포맷팅
 * @example
 * formatPercent(0.1234) // "12.3%"
 * formatPercent(45.678, 1) // "45.7%"
 */
export function formatPercent(value: number, decimals = 1): string {
  // 0~1 범위의 비율인 경우 100을 곱함
  const percentage = value <= 1 && value >= 0 ? value * 100 : value;
  return `${percentage.toFixed(decimals)}%`;
}
