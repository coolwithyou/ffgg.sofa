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
  documentId?: string;
  status?: ChunkStatus | ChunkStatus[];
  minQualityScore?: number;
  maxQualityScore?: number;
  search?: string;
  sortBy?: 'qualityScore' | 'chunkIndex' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ChunkListResult {
  chunks: ChunkReviewItem[];
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
