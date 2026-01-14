/**
 * 문서 길이 제한 유틸리티
 *
 * 긴 문서 처리 시 truncation 발생을 추적하고 경고합니다.
 * 향후 청킹 전략 도입 필요성 판단을 위한 통계 수집용.
 */

export interface TruncationResult {
  /** 처리된 텍스트 (필요시 잘린 상태) */
  text: string;
  /** truncation 발생 여부 */
  wasTruncated: boolean;
  /** 원본 길이 (문자 수) */
  originalLength: number;
  /** 처리된 길이 (문자 수) */
  processedLength: number;
  /** 손실된 길이 (문자 수) */
  lostLength: number;
  /** 손실률 (%) */
  lostPercentage: number;
}

export interface TruncationOptions {
  /** 최대 허용 문자 수 */
  maxChars: number;
  /** truncation 발생 시 추가할 메시지 */
  truncationMessage?: string;
  /** 로깅용 컨텍스트 (어떤 작업에서 발생했는지) */
  context: string;
  /** 경고 로그 출력 여부 (기본: true) */
  logWarning?: boolean;
}

/**
 * 텍스트를 안전하게 truncate하고 통계를 반환합니다.
 *
 * @example
 * const result = truncateWithWarning(longText, {
 *   maxChars: 200000,
 *   context: 'markdown-reconstructor',
 * });
 *
 * if (result.wasTruncated) {
 *   console.warn(`${result.lostPercentage}% 손실`);
 * }
 */
export function truncateWithWarning(
  text: string,
  options: TruncationOptions
): TruncationResult {
  const {
    maxChars,
    truncationMessage = '\n\n[문서가 너무 길어 일부만 처리됩니다...]',
    context,
    logWarning = true,
  } = options;

  const originalLength = text.length;
  const wasTruncated = originalLength > maxChars;

  if (!wasTruncated) {
    return {
      text,
      wasTruncated: false,
      originalLength,
      processedLength: originalLength,
      lostLength: 0,
      lostPercentage: 0,
    };
  }

  // Truncate 수행
  const truncatedText = text.slice(0, maxChars) + truncationMessage;
  const lostLength = originalLength - maxChars;
  const lostPercentage = Math.round((lostLength / originalLength) * 100);

  // 경고 로그 출력
  if (logWarning) {
    console.warn(
      `⚠️ [${context}] 문서 truncation 발생:\n` +
        `   - 원본: ${formatBytes(originalLength)} (${originalLength.toLocaleString()}자)\n` +
        `   - 제한: ${formatBytes(maxChars)} (${maxChars.toLocaleString()}자)\n` +
        `   - 손실: ${formatBytes(lostLength)} (${lostLength.toLocaleString()}자, ${lostPercentage}%)\n` +
        `   💡 문서를 분할하거나 청킹 전략 도입을 고려하세요.`
    );
  }

  return {
    text: truncatedText,
    wasTruncated: true,
    originalLength,
    processedLength: maxChars,
    lostLength,
    lostPercentage,
  };
}

/**
 * 바이트 수를 읽기 쉬운 형식으로 변환 (대략적인 토큰 수 포함)
 */
function formatBytes(chars: number): string {
  // 한글 기준 약 1.5자 = 1토큰, 영문 기준 약 4자 = 1토큰
  // 평균적으로 약 2-3자 = 1토큰으로 추정
  const estimatedTokens = Math.round(chars / 2.5);

  if (chars < 1000) {
    return `${chars}자 (~${estimatedTokens} 토큰)`;
  } else if (chars < 1000000) {
    return `${(chars / 1000).toFixed(1)}K자 (~${(estimatedTokens / 1000).toFixed(1)}K 토큰)`;
  } else {
    return `${(chars / 1000000).toFixed(2)}M자 (~${(estimatedTokens / 1000000).toFixed(2)}M 토큰)`;
  }
}

/**
 * 여러 truncation 결과를 집계하여 요약 통계를 반환합니다.
 * 파이프라인 전체의 truncation 현황 파악용.
 */
export function summarizeTruncations(
  results: TruncationResult[]
): TruncationSummary {
  const truncatedResults = results.filter((r) => r.wasTruncated);

  return {
    totalDocuments: results.length,
    truncatedDocuments: truncatedResults.length,
    truncationRate: Math.round(
      (truncatedResults.length / results.length) * 100
    ),
    totalOriginalChars: results.reduce((sum, r) => sum + r.originalLength, 0),
    totalLostChars: results.reduce((sum, r) => sum + r.lostLength, 0),
    avgLostPercentage:
      truncatedResults.length > 0
        ? Math.round(
            truncatedResults.reduce((sum, r) => sum + r.lostPercentage, 0) /
              truncatedResults.length
          )
        : 0,
    maxLostPercentage:
      truncatedResults.length > 0
        ? Math.max(...truncatedResults.map((r) => r.lostPercentage))
        : 0,
  };
}

export interface TruncationSummary {
  /** 총 처리 문서 수 */
  totalDocuments: number;
  /** truncation 발생 문서 수 */
  truncatedDocuments: number;
  /** truncation 발생률 (%) */
  truncationRate: number;
  /** 총 원본 문자 수 */
  totalOriginalChars: number;
  /** 총 손실 문자 수 */
  totalLostChars: number;
  /** 평균 손실률 (%) - truncated 문서 기준 */
  avgLostPercentage: number;
  /** 최대 손실률 (%) */
  maxLostPercentage: number;
}

// 상수: 각 처리 단계별 권장 제한
export const TRUNCATION_LIMITS = {
  /** 마크다운 재구성 - 가장 긴 출력 필요 */
  MARKDOWN_RECONSTRUCTION: 200_000,
  /** 문서 구조 분석 */
  STRUCTURE_ANALYSIS: 200_000,
  /** 소스 텍스트 추출 */
  SOURCE_TEXT_EXTRACTION: 100_000,
  /** 클레임 추출 */
  CLAIM_EXTRACTION: 100_000,
  /** 클레임 검증 */
  CLAIM_VERIFICATION: 80_000,
} as const;
