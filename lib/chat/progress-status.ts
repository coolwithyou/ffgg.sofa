/**
 * 진행 상태 타입 정의
 * 채널톡 ALF 스타일의 단계별 진행 상태 표시를 위한 타입들
 */

/**
 * 진행 단계 식별자
 */
export type ProgressStep =
  | 'query_analysis'    // 질문 분석 중...
  | 'searching'         // 관련 문서 검색 중...
  | 'reranking'         // 검색 결과 정렬 중...
  | 'generating'        // 답변 생성 중...
  | 'complete';         // 완료

/**
 * 진행 상태 이벤트
 */
export interface ProgressEvent {
  type: 'status';
  step: ProgressStep;
  message: string;
  elapsed?: number;  // ms
}

/**
 * 답변 콘텐츠 스트리밍 이벤트
 */
export interface ContentEvent {
  type: 'content';
  content: string;
}

/**
 * 출처 정보
 */
export interface Source {
  id: string;
  chunkId: string;
  documentId: string;
  title?: string;
  content: string;      // snippet
  relevance: number;    // 0-1
  documentName?: string;
}

/**
 * 출처 정보 이벤트
 */
export interface SourcesEvent {
  type: 'sources';
  sources: Source[];
}

/**
 * 에러 이벤트
 */
export interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/**
 * 완료 이벤트
 */
export interface DoneEvent {
  type: 'done';
  totalTime?: number;  // ms
}

/**
 * 모든 SSE 이벤트 타입 유니온
 */
export type ChatStreamEvent =
  | ProgressEvent
  | ContentEvent
  | SourcesEvent
  | ErrorEvent
  | DoneEvent;

/**
 * 진행 단계별 메시지 (한글)
 */
export const PROGRESS_MESSAGES: Record<ProgressStep, string> = {
  query_analysis: '질문 분석 중...',
  searching: '관련 문서 검색 중...',
  reranking: '검색 결과 정렬 중...',
  generating: '답변 생성 중...',
  complete: '완료',
};

/**
 * 진행 상태 이벤트 생성 헬퍼
 */
export function createProgressEvent(
  step: ProgressStep,
  elapsed?: number
): ProgressEvent {
  return {
    type: 'status',
    step,
    message: PROGRESS_MESSAGES[step],
    elapsed,
  };
}

/**
 * 출처 이벤트 생성 헬퍼
 */
export function createSourcesEvent(sources: Source[]): SourcesEvent {
  return {
    type: 'sources',
    sources,
  };
}

/**
 * SSE 이벤트를 문자열로 직렬화
 */
export function serializeEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * 진행 상태 추적기 클래스
 */
export class ProgressTracker {
  private startTime: number;
  private stepStartTime: number;
  private onProgress?: (event: ProgressEvent) => void;

  constructor(onProgress?: (event: ProgressEvent) => void) {
    this.startTime = Date.now();
    this.stepStartTime = this.startTime;
    this.onProgress = onProgress;
  }

  /**
   * 새 단계 시작
   */
  startStep(step: ProgressStep): void {
    const elapsed = Date.now() - this.startTime;
    const event = createProgressEvent(step, elapsed);
    this.stepStartTime = Date.now();
    this.onProgress?.(event);
  }

  /**
   * 전체 경과 시간
   */
  getTotalElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 현재 단계 경과 시간
   */
  getStepElapsed(): number {
    return Date.now() - this.stepStartTime;
  }
}
