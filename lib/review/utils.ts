/**
 * 청크 메트릭 관련 유틸리티 함수
 */

import type {
  SearchabilityStatus,
  QualityGrade,
  ChunkMetrics,
} from './types';

// ========================================
// 토큰 추정
// ========================================

/**
 * 텍스트 길이를 기반으로 토큰 수 추정
 * - 한국어/CJK: 약 2-3자당 1토큰
 * - 영어/라틴어: 약 4자당 1토큰
 * - 혼합 텍스트는 평균값 사용
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  // CJK 문자 개수 (한중일 문자)
  const cjkPattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g;
  const cjkMatches = text.match(cjkPattern);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // 나머지 문자 (라틴어, 숫자, 기호 등)
  const otherCount = text.length - cjkCount;

  // CJK: ~2.5자/토큰, 기타: ~4자/토큰
  const cjkTokens = cjkCount / 2.5;
  const otherTokens = otherCount / 4;

  return Math.ceil(cjkTokens + otherTokens);
}

// ========================================
// 상대 시간 포맷
// ========================================

/**
 * Date를 상대 시간 문자열로 변환
 * 예: "방금 전", "5분 전", "2시간 전", "어제", "3일 전"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return '방금 전';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays === 1) {
    return '어제';
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}주 전`;
  } else {
    // 30일 이상은 날짜 표시
    return target.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

// ========================================
// 검색 상태 판단
// ========================================

/**
 * 임베딩 및 TSV 존재 여부로 검색 가능 상태 판단
 */
export function determineSearchability(
  hasEmbedding: boolean,
  hasContentTsv: boolean
): SearchabilityStatus {
  if (hasEmbedding && hasContentTsv) {
    return 'full';
  } else if (hasEmbedding || hasContentTsv) {
    return 'partial';
  } else {
    return 'none';
  }
}

/**
 * 검색 상태에 따른 표시 라벨
 */
export function getSearchabilityLabel(status: SearchabilityStatus): string {
  switch (status) {
    case 'full':
      return 'H'; // Hybrid
    case 'partial':
      return 'P'; // Partial
    case 'none':
      return '-'; // Not searchable
  }
}

/**
 * 검색 상태 상세 라벨 (Dense/Sparse 구분)
 */
export function getSearchabilityDetailLabel(
  hasEmbedding: boolean,
  hasContentTsv: boolean
): string {
  if (hasEmbedding && hasContentTsv) {
    return 'H'; // Hybrid
  } else if (hasEmbedding) {
    return 'D'; // Dense only
  } else if (hasContentTsv) {
    return 'S'; // Sparse only
  } else {
    return '-'; // None
  }
}

// ========================================
// 품질 등급 판단
// ========================================

/**
 * 품질 점수를 등급으로 변환
 */
export function getQualityGrade(score: number | null): QualityGrade {
  if (score === null || score === undefined) {
    return 'unscored';
  } else if (score >= 80) {
    return 'excellent';
  } else if (score >= 60) {
    return 'good';
  } else if (score >= 40) {
    return 'fair';
  } else {
    return 'poor';
  }
}

/**
 * 품질 등급에 따른 CSS 클래스
 */
export function getQualityGradeColor(grade: QualityGrade): string {
  switch (grade) {
    case 'excellent':
      return 'bg-green-500/10 text-green-500';
    case 'good':
      return 'bg-primary/10 text-primary';
    case 'fair':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'poor':
      return 'bg-destructive/10 text-destructive';
    case 'unscored':
      return 'bg-muted text-muted-foreground';
  }
}

// ========================================
// 검색 상태 스타일
// ========================================

/**
 * 검색 상태에 따른 CSS 클래스
 */
export function getSearchabilityColor(status: SearchabilityStatus): string {
  switch (status) {
    case 'full':
      return 'bg-green-500/10 text-green-500';
    case 'partial':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'none':
      return 'bg-destructive/10 text-destructive';
  }
}

// ========================================
// 메트릭 생성 헬퍼
// ========================================

/**
 * 청크 데이터로부터 메트릭 객체 생성
 */
export function createChunkMetrics(chunk: {
  content: string | null;
  contextPrefix?: string | null;
  embedding?: unknown | null;
  contentTsv?: unknown | null;
  version?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): ChunkMetrics {
  const content = chunk.content || '';
  const contextPrefix = chunk.contextPrefix || null;
  const hasEmbedding = chunk.embedding !== null && chunk.embedding !== undefined;
  const hasContentTsv = chunk.contentTsv !== null && chunk.contentTsv !== undefined;

  return {
    hasEmbedding,
    hasContentTsv,
    searchability: determineSearchability(hasEmbedding, hasContentTsv),
    contentLength: content.length,
    estimatedTokens: estimateTokenCount(content),
    contextLength: contextPrefix ? contextPrefix.length : null,
    version: chunk.version ?? 1,
    isModified: isChunkModified(chunk.createdAt, chunk.updatedAt),
  };
}

/**
 * 청크가 생성 후 수정되었는지 확인
 */
function isChunkModified(
  createdAt?: Date | string,
  updatedAt?: Date | string
): boolean {
  if (!createdAt || !updatedAt) return false;

  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const updated = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;

  // 1초 이상 차이나면 수정된 것으로 간주
  return Math.abs(updated.getTime() - created.getTime()) > 1000;
}

// ========================================
// 크기 포맷팅
// ========================================

/**
 * 바이트를 읽기 쉬운 형식으로 변환
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 청크 크기를 "문자수/토큰수" 형식으로 포맷
 */
export function formatChunkSize(contentLength: number, tokenCount: number): string {
  return `${contentLength.toLocaleString()}/${tokenCount.toLocaleString()}`;
}
