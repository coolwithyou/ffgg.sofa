/**
 * RAG 평가 시스템 모듈
 *
 * RAGAS 스타일의 RAG 파이프라인 평가 도구를 제공합니다.
 *
 * @example
 * ```typescript
 * import { loadDataset, evaluateDataset, printSummary } from '@/lib/rag/evaluation';
 *
 * const dataset = await loadDataset('data/evaluation/sample-dataset.json');
 * const report = await evaluateDataset(dataset);
 * printSummary(report);
 * ```
 */

// 타입
export type {
  QuestionType,
  EvaluationItem,
  EvaluationDataset,
  EvaluationOptions,
  EvaluationReport,
  ItemEvaluationResult,
  MetricScores,
  MetricAnalysis,
  MetricName,
  MetricResult,
  FaithfulnessAnalysis,
  AnswerRelevancyAnalysis,
  ContextPrecisionAnalysis,
  ContextRecallAnalysis,
} from './types';

// 데이터셋
export { loadDataset, getDatasetStats } from './dataset';

// 평가 엔진
export { RagEvaluator, evaluateDataset } from './evaluator';

// 리포터
export { printSummary, generateReportFile, generateMarkdownReport } from './reporter';

// 메트릭 (개별 사용 가능)
export {
  evaluateFaithfulness,
  evaluateAnswerRelevancy,
  evaluateContextPrecision,
  evaluateContextRecall,
} from './metrics';
