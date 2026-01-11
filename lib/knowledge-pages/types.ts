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
