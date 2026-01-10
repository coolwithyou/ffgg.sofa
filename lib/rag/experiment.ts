/**
 * Phase 5: A/B 테스트 및 품질 검증 - 전략 결정 로직
 *
 * 챗봇별 청킹 전략을 결정하고 A/B 테스트 트래픽을 분배합니다.
 *
 * @see docs/testplans/phase5-ab-test-quality-validation.md
 */

import { isSemanticChunkingEnabled } from './semantic-chunking';
import type {
  ExperimentConfig,
  ExperimentVariant,
  ChunkingStrategy,
  ChunkExperimentMetadata,
} from '@/types/experiment';

/**
 * 전략 결정 사유
 */
export type StrategyReason = 'global_setting' | 'ab_test' | 'fixed_strategy';

/**
 * 청킹 전략 결정 결과
 */
export interface ChunkingStrategyResult {
  /** 선택된 전략 */
  strategy: Exclude<ChunkingStrategy, 'auto'>;

  /** A/B 테스트 변형 (null = A/B 테스트 아님) */
  variant: ExperimentVariant | null;

  /** 결정 사유 */
  reason: StrategyReason;
}

/**
 * 챗봇별 청킹 전략 결정
 *
 * 우선순위:
 * 1. experimentConfig가 있으면 해당 설정 사용
 * 2. A/B 테스트 활성화 시 트래픽 비율에 따라 분배
 * 3. 없으면 글로벌 환경변수 설정 사용
 *
 * @param chatbotId - 챗봇 ID
 * @param experimentConfig - 챗봇별 실험 설정 (null이면 글로벌 설정)
 * @param documentId - 문서 ID (일관된 A/B 분배에 사용, 선택적)
 * @returns 청킹 전략 결정 결과
 *
 * @example
 * ```typescript
 * const result = determineChunkingStrategy('chatbot-123', {
 *   chunkingStrategy: 'auto',
 *   abTestEnabled: true,
 *   semanticTrafficPercent: 50,
 * });
 * // result.strategy = 'semantic' or 'smart'
 * // result.variant = 'treatment' or 'control'
 * ```
 */
export function determineChunkingStrategy(
  chatbotId: string,
  experimentConfig: ExperimentConfig | null,
  documentId?: string
): ChunkingStrategyResult {
  // 1. experimentConfig 없으면 글로벌 설정 사용
  if (!experimentConfig) {
    return {
      strategy: isSemanticChunkingEnabled() ? 'semantic' : 'smart',
      variant: null,
      reason: 'global_setting',
    };
  }

  // 2. A/B 테스트 활성화 시 트래픽 분배
  if (experimentConfig.abTestEnabled) {
    const semanticPercent = experimentConfig.semanticTrafficPercent ?? 50;

    // 문서 ID가 있으면 일관된 분배, 없으면 랜덤 분배
    const isSemanticVariant = documentId
      ? getConsistentVariant(documentId, semanticPercent) === 'treatment'
      : Math.random() * 100 < semanticPercent;

    return {
      strategy: isSemanticVariant ? 'semantic' : 'smart',
      variant: isSemanticVariant ? 'treatment' : 'control',
      reason: 'ab_test',
    };
  }

  // 3. 고정 전략
  const configStrategy = experimentConfig.chunkingStrategy;

  // auto인 경우 글로벌 설정 사용
  if (configStrategy === 'auto') {
    return {
      strategy: isSemanticChunkingEnabled() ? 'semantic' : 'smart',
      variant: null,
      reason: 'fixed_strategy',
    };
  }

  // late, semantic, smart 중 하나
  return {
    strategy: configStrategy,
    variant: null,
    reason: 'fixed_strategy',
  };
}

/**
 * 문서 ID 기반 일관된 A/B 분배
 *
 * 동일 문서가 항상 같은 그룹에 배정되도록 해시 기반 분배.
 * 재처리 시에도 일관된 결과를 보장합니다.
 *
 * @param documentId - 문서 ID
 * @param semanticTrafficPercent - semantic 전략 트래픽 비율 (0-100)
 * @returns A/B 테스트 변형
 *
 * @example
 * ```typescript
 * // 동일 문서 ID는 항상 같은 결과
 * getConsistentVariant('doc-123', 50); // 항상 'treatment' 또는 항상 'control'
 * ```
 */
export function getConsistentVariant(
  documentId: string,
  semanticTrafficPercent: number
): ExperimentVariant {
  // FNV-1a 해시 알고리즘 (간단하고 빠름)
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < documentId.length; i++) {
    hash ^= documentId.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // 양수로 변환 후 0-99 범위로 매핑
  const bucket = Math.abs(hash) % 100;

  return bucket < semanticTrafficPercent ? 'treatment' : 'control';
}

/**
 * 전략 결과를 청크 메타데이터 형식으로 변환
 *
 * @param result - 청킹 전략 결정 결과
 * @returns 청크 메타데이터에 포함할 실험 정보
 */
export function toChunkExperimentMetadata(
  result: ChunkingStrategyResult
): ChunkExperimentMetadata {
  return {
    chunkingStrategy: result.strategy,
    experimentVariant: result.variant,
    strategyReason: result.reason,
  };
}

/**
 * A/B 테스트 활성화 여부 확인
 *
 * @param experimentConfig - 실험 설정
 * @returns A/B 테스트 활성화 여부
 */
export function isABTestActive(
  experimentConfig: ExperimentConfig | null
): boolean {
  if (!experimentConfig) return false;
  return experimentConfig.abTestEnabled === true;
}

/**
 * 실험 기간 내 여부 확인
 *
 * @param experimentConfig - 실험 설정
 * @returns 현재 시점이 실험 기간 내인지 여부
 */
export function isWithinExperimentPeriod(
  experimentConfig: ExperimentConfig | null
): boolean {
  if (!experimentConfig) return false;
  if (!experimentConfig.abTestEnabled) return false;

  const now = new Date();

  // 시작일 체크
  if (experimentConfig.experimentStartedAt) {
    const startDate = new Date(experimentConfig.experimentStartedAt);
    if (now < startDate) return false;
  }

  // 종료일 체크
  if (experimentConfig.experimentEndedAt) {
    const endDate = new Date(experimentConfig.experimentEndedAt);
    if (now > endDate) return false;
  }

  return true;
}

/**
 * 전략 이름을 한글로 변환
 *
 * @param strategy - 청킹 전략
 * @returns 한글 전략명
 */
export function getStrategyDisplayName(strategy: ChunkingStrategy): string {
  const names: Record<ChunkingStrategy, string> = {
    smart: '규칙 기반',
    semantic: 'AI 의미 기반',
    late: 'Late Chunking',
    auto: '자동',
  };
  return names[strategy] ?? strategy;
}

/**
 * 변형 이름을 한글로 변환
 *
 * @param variant - A/B 테스트 변형
 * @returns 한글 변형명
 */
export function getVariantDisplayName(
  variant: ExperimentVariant | null
): string {
  if (!variant) return '-';
  return variant === 'control' ? '대조군' : '처리군';
}
