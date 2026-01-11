/**
 * Document → Knowledge Pages 변환 타입 정의
 *
 * 업로드된 문서를 LLM을 사용하여 계층적인 Knowledge Pages로
 * 자동 변환하는 기능의 타입들을 정의합니다.
 */

/**
 * LLM 구조 분석 결과
 * 문서 전체의 구조를 계층적 페이지 트리로 표현
 */
export interface DocumentStructure {
  title: string;
  pages: PageNode[];
}

/**
 * 구조 분석에서 추출된 페이지 노드
 */
export interface PageNode {
  /** 슬러그 형태의 ID (예: "installation", "quick-start") */
  id: string;
  /** 페이지 제목 */
  title: string;
  /** 원본 문서 페이지 번호들 */
  sourcePages: number[];
  /** 이 페이지가 다루는 내용 요약 */
  contentSummary: string;
  /** 하위 페이지 */
  children: PageNode[];
  /** 마크다운 시작 라인 (Human-in-the-loop 검증용) */
  startLine?: number;
  /** 마크다운 종료 라인 (Human-in-the-loop 검증용) */
  endLine?: number;
  /** 헤더 레벨 (1-6, 구조 복원용) */
  level?: number;
}

/**
 * 콘텐츠 생성 결과
 * 각 페이지의 마크다운 콘텐츠 포함
 */
export interface GeneratedPage {
  /** 슬러그 형태의 ID */
  id: string;
  /** 페이지 제목 */
  title: string;
  /** 마크다운 형식의 콘텐츠 */
  content: string;
  /** 원본 문서 페이지 번호들 */
  sourcePages: number[];
  /** AI 변환 신뢰도 (0-1) */
  confidence: number;
  /** 하위 페이지 */
  children: GeneratedPage[];
}

/**
 * 변환 옵션
 */
export interface ConversionOptions {
  /** 챗봇 ID */
  chatbotId: string;
  /** 원본 문서 ID (sourceDocumentId로 저장) */
  documentId?: string;
  /** 특정 페이지 하위에 생성할 경우 */
  parentPageId?: string;
  /** 최소 단어 수 (기본: 100) */
  minPageWords?: number;
  /** 최대 단어 수 (기본: 800) */
  maxPageWords?: number;
  /** 문서 제목을 루트 페이지로 사용 */
  preserveDocumentTitle?: boolean;
}

/**
 * 변환 진행 상태 (프로그레스 표시용)
 */
export interface ConversionProgress {
  /** 현재 상태 */
  status: 'parsing' | 'analyzing' | 'generating' | 'saving' | 'completed' | 'failed';
  /** 현재 단계 설명 */
  currentStep: string;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 완료된 페이지 수 */
  completedPages: number;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 변환 결과
 */
export interface ConversionResult {
  /** 성공 여부 */
  success: boolean;
  /** 생성된 페이지들 */
  pages?: GeneratedPage[];
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 생성된 페이지 총 수 */
  totalPageCount?: number;
}

/**
 * Inngest 이벤트 데이터
 */
export interface ConvertDocumentEventData {
  /** 문서 ID */
  documentId: string;
  /** 챗봇 ID */
  chatbotId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 변환 옵션 */
  options?: Omit<ConversionOptions, 'chatbotId' | 'documentId'>;
}

// =============================================================================
// Human-in-the-loop Verification Types
// =============================================================================

/**
 * 검증 세션 상태
 * 상태 머신: pending → analyzing → extracting_claims → verifying → ready_for_review → reviewing → approved/rejected
 */
export type ValidationStatus =
  | 'pending'
  | 'analyzing'
  | 'extracting_claims'
  | 'verifying'
  | 'ready_for_review'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'expired';

/**
 * Claim 타입
 * - numeric: 숫자 데이터 (가격, 수량 등)
 * - contact: 연락처 (전화번호, 이메일)
 * - date: 날짜/시간 정보
 * - text: 일반 텍스트 주장
 * - list: 목록 형태 데이터
 * - table: 표 형태 데이터
 */
export type ClaimType = 'numeric' | 'contact' | 'date' | 'text' | 'list' | 'table';

/**
 * AI 판정 결과
 * - supported: 원문에서 근거 발견
 * - contradicted: 원문과 모순됨
 * - not_found: 원문에서 찾을 수 없음
 * - pending: 검증 대기
 */
export type Verdict = 'supported' | 'contradicted' | 'not_found' | 'pending';

/**
 * 위험도 레벨
 * - high: 필수 검토 대상 (contradicted/not_found + 중요 정보)
 * - medium: 권장 검토 대상
 * - low: 자동 승인 가능
 */
export type RiskLevel = 'high' | 'medium' | 'low';

/**
 * 검증 레벨
 * - regex: 정규식 기반 검증 (Level 1)
 * - llm: LLM 기반 검증 (Level 2)
 * - human: 사람이 최종 확인 (Level 3)
 */
export type VerificationLevel = 'regex' | 'llm' | 'human';

/**
 * 의심 유형 (AI가 발견한 문제)
 * - added: 원문에 없는 정보가 추가됨
 * - missing: 원문의 정보가 누락됨
 * - moved: 정보가 다른 컨텍스트로 이동됨
 * - contradicted: 원문과 내용이 다름
 * - none: 문제 없음
 */
export type SuspicionType = 'added' | 'missing' | 'moved' | 'contradicted' | 'none';

/**
 * 사용자 판정 결과
 * - approved: 승인
 * - rejected: 거부
 * - modified: 수정 후 승인
 * - skipped: 건너뜀
 */
export type HumanVerdict = 'approved' | 'rejected' | 'modified' | 'skipped';

/**
 * 매칭 방법
 * - exact: 정확히 일치
 * - fuzzy: 유사 일치 (Fuse.js)
 * - semantic: 의미적 유사성 (임베딩)
 */
export type MatchMethod = 'exact' | 'fuzzy' | 'semantic';

/**
 * 검증 이벤트 데이터 (Inngest)
 */
export interface ValidateDocumentEventData {
  /** 검증 세션 ID */
  sessionId: string;
  /** 챗봇 ID */
  chatbotId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 상위 페이지 ID (있는 경우) */
  parentPageId?: string;
}

/**
 * 재구성 마크다운 내 위치 정보
 */
export interface ReconstructedLocation {
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

/**
 * 페이지 매핑 정보 (PDF → 텍스트 위치)
 */
export interface PageMapping {
  pageNumber: number;
  startChar: number;
  endChar: number;
}

/**
 * 검증 요약 통계
 */
export interface ValidationSummary {
  totalClaims: number;
  supportedCount: number;
  contradictedCount: number;
  notFoundCount: number;
  highRiskCount: number;
  riskScore: number;
}
