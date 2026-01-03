/**
 * 내부 검토 도구 타입 정의
 */

export type ChunkStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface ChunkReviewItem {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;
  qualityScore: number | null;
  status: ChunkStatus;
  autoApproved: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Contextual Retrieval 관련 필드
  contextPrefix?: string | null;
  contextPrompt?: string | null;
  hasContext?: boolean;
}

export interface ChunkListFilter {
  tenantId: string;
  chatbotId?: string; // 챗봇별 필터링 (연결된 데이터셋의 문서만)
  documentId?: string;
  status?: ChunkStatus | ChunkStatus[];
  minQualityScore?: number;
  maxQualityScore?: number;
  search?: string;
  sortBy?: 'qualityScore' | 'chunkIndex' | 'createdAt' | 'status' | 'contentLength';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  // 확장 필터 (v2)
  searchability?: SearchabilityStatus | SearchabilityStatus[];
  hasContext?: boolean;
  minContentLength?: number;
  maxContentLength?: number;
  includeMetrics?: boolean; // true면 metrics 포함
}

export interface ChunkListResult {
  chunks: ChunkReviewItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ChunkListResultWithMetrics {
  chunks: ChunkReviewItemWithMetrics[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ChunkUpdateInput {
  content?: string;
  status?: ChunkStatus;
  qualityScore?: number;
}

export interface BulkUpdateInput {
  chunkIds: string[];
  status: ChunkStatus;
}

export interface BulkUpdateResult {
  updated: number;
  failed: number;
  errors?: string[];
}

export interface DeploymentStatus {
  tenantId: string;
  documentId?: string;
  totalChunks: number;
  approvedChunks: number;
  pendingChunks: number;
  rejectedChunks: number;
  modifiedChunks: number;
  deployedAt?: string;
  lastModifiedAt: string;
}

export interface AutoApprovalConfig {
  enabled: boolean;
  minQualityScore: number; // 0-100, 이 점수 이상이면 자동 승인
  requiresQAPair?: boolean;
}

// 키보드 단축키 액션
export type ReviewAction = 'approve' | 'skip' | 'modify' | 'edit' | 'delete';

export interface ReviewActionResult {
  success: boolean;
  action: ReviewAction;
  chunkId: string;
  message?: string;
}

// ========================================
// 청크 메트릭 & 검색 상태 타입 (v2 확장)
// ========================================

/**
 * 검색 가능 상태
 * - full: Dense + Sparse 모두 가능 (Hybrid 검색 완전 지원)
 * - partial: 둘 중 하나만 가능
 * - none: 검색 불가 (임베딩/TSV 모두 없음)
 */
export type SearchabilityStatus = 'full' | 'partial' | 'none';

/**
 * 품질 등급 (qualityScore 기반)
 */
export type QualityGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'unscored';

/**
 * 청크 단위 메트릭 정보
 */
export interface ChunkMetrics {
  hasEmbedding: boolean;
  hasContentTsv: boolean;
  searchability: SearchabilityStatus;
  contentLength: number;
  estimatedTokens: number;
  contextLength: number | null;
  version: number;
  isModified: boolean; // 원본 대비 수정 여부
}

/**
 * 확장된 청크 리뷰 아이템 (메트릭 포함)
 */
export interface ChunkReviewItemWithMetrics extends ChunkReviewItem {
  metrics: ChunkMetrics;
}

/**
 * 데이터 무결성 이슈 통계
 */
export interface IntegrityIssues {
  emptyContent: number;
  missingEmbedding: number;
  missingTsv: number;
  duplicateContent: number;
  unscored: number;
}

/**
 * 검색 가능 상태별 통계
 */
export interface SearchabilityStats {
  denseReady: number;    // 임베딩 있음
  sparseReady: number;   // contentTsv 있음
  hybridReady: number;   // 둘 다 있음
  notSearchable: number; // 둘 다 없음
}

/**
 * 품질 등급별 분포
 */
export interface QualityDistribution {
  excellent: number; // >= 80
  good: number;      // >= 60
  fair: number;      // >= 40
  poor: number;      // < 40
  unscored: number;  // null
}

/**
 * 데이터셋 확장 통계
 */
export interface DatasetExtendedStats {
  searchability: SearchabilityStats;
  quality: QualityDistribution;
  integrity: IntegrityIssues;
  averageChunkSize: number;
  averageTokenCount: number;
}
