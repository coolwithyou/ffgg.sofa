/**
 * RAG 평가 시스템 타입 정의
 *
 * RAGAS 스타일의 평가 메트릭과 데이터셋 구조를 정의합니다.
 */

/** 평가 질문 유형 */
export type QuestionType =
  | 'factual' // 사실 확인
  | 'followup' // 후속 질문 (Query Rewriting 효과 측정)
  | 'comparison' // 비교 질문
  | 'procedural' // 절차/방법 질문
  | 'reasoning' // 추론 질문
  | 'unanswerable'; // 답변 불가 (할루시네이션 테스트)

/** 평가 세트 항목 */
export interface EvaluationItem {
  id: string;
  question: string;
  questionType: QuestionType;
  groundTruth: string;
  /** 정답 근거가 되는 청크 ID (Context Recall용) */
  groundTruthChunks?: string[];
  /** 후속 질문용 대화 히스토리 */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  metadata?: Record<string, unknown>;
}

/** 평가 세트 */
export interface EvaluationDataset {
  version: string;
  name: string;
  description?: string;
  tenantId: string;
  /** 검색 대상 데이터셋 ID (선택) */
  datasetIds?: string[];
  items: EvaluationItem[];
  createdAt: string;
  updatedAt: string;
}

/** 검색된 청크 정보 */
export interface RetrievedChunk {
  chunkId: string;
  content: string;
  score: number;
}

/** Faithfulness 분석 결과 */
export interface FaithfulnessAnalysis {
  claims: Array<{
    claim: string;
    supportedByContext: boolean;
    evidence?: string;
  }>;
  unsupportedClaims: string[];
}

/** Answer Relevancy 분석 결과 */
export interface AnswerRelevancyAnalysis {
  relevanceReasoning: string;
  addressesQuestion: boolean;
  partiallyAddressed?: string[];
}

/** Context Precision 분석 결과 */
export interface ContextPrecisionAnalysis {
  rankedChunks: Array<{
    chunkId: string;
    rank: number;
    isRelevant: boolean;
    relevanceReason?: string;
  }>;
  precisionAtK: Record<number, number>;
}

/** Context Recall 분석 결과 */
export interface ContextRecallAnalysis {
  requiredInfo: string[];
  foundInfo: string[];
  missingInfo: string[];
}

/** 메트릭 점수 */
export interface MetricScores {
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall?: number;
}

/** 상세 분석 결과 */
export interface MetricAnalysis {
  faithfulness?: FaithfulnessAnalysis;
  answerRelevancy?: AnswerRelevancyAnalysis;
  contextPrecision?: ContextPrecisionAnalysis;
  contextRecall?: ContextRecallAnalysis;
}

/** 단일 항목 평가 결과 */
export interface ItemEvaluationResult {
  itemId: string;
  question: string;
  questionType: QuestionType;

  // RAG 파이프라인 출력
  rewrittenQuery?: string;
  retrievedChunks: RetrievedChunk[];
  generatedAnswer: string;

  // 메트릭 점수 (0-1)
  scores: MetricScores;

  // 상세 분석
  analysis: MetricAnalysis;

  // 실행 메타데이터
  executionTime: number;
  tokenUsage?: {
    retrieval: number;
    generation: number;
    evaluation: number;
  };
}

/** 질문 유형별 통계 */
export interface QuestionTypeStats {
  count: number;
  avgFaithfulness: number;
  avgAnswerRelevancy: number;
  avgContextPrecision: number;
  avgContextRecall?: number;
}

/** Query Rewriting 효과 분석 */
export interface QueryRewritingImpact {
  itemsWithRewriting: number;
  avgScoreImprovement: number;
}

/** 전체 평가 결과 리포트 */
export interface EvaluationReport {
  datasetName: string;
  datasetVersion: string;
  evaluatedAt: string;

  // 전체 통계
  summary: {
    totalItems: number;
    avgFaithfulness: number;
    avgAnswerRelevancy: number;
    avgContextPrecision: number;
    avgContextRecall?: number;

    // 질문 유형별 분석
    byQuestionType: Partial<Record<QuestionType, QuestionTypeStats>>;

    // Query Rewriting 효과
    queryRewritingImpact?: QueryRewritingImpact;
  };

  // 개별 항목 결과
  results: ItemEvaluationResult[];

  // 실행 메타데이터
  executionMetadata: {
    totalDuration: number;
    totalTokenUsage: {
      retrieval: number;
      generation: number;
      evaluation: number;
    };
    evaluationModel: string;
  };
}

/** 메트릭 이름 */
export type MetricName = 'faithfulness' | 'answerRelevancy' | 'contextPrecision' | 'contextRecall';

/** 평가 옵션 */
export interface EvaluationOptions {
  /** 평가에 사용할 LLM (기본: gemini-2.5-flash-lite) */
  evaluationModel?: 'gemini-2.5-flash-lite' | 'gpt-4o-mini';

  /** 검색 결과 개수 (기본: 5) */
  maxChunks?: number;

  /** 메트릭 선택 (기본: 전체) */
  metrics?: MetricName[];

  /** 병렬 처리 개수 (기본: 3) */
  concurrency?: number;

  /** 진행 콜백 */
  onProgress?: (current: number, total: number, item?: EvaluationItem) => void;

  /** Query Rewriting 비교 모드 */
  compareWithoutRewriting?: boolean;

  /** LLM 생성 temperature (기본: 0.3) */
  temperature?: number;
}

/** 메트릭 평가 결과 */
export interface MetricResult<T> {
  score: number;
  analysis: T;
}
