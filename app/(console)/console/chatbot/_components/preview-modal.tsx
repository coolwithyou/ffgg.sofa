'use client';

/**
 * 문서 미리보기 모달 컴포넌트
 * 업로드 전 청킹 결과와 품질 점수를 미리 확인
 */

import { useState } from 'react';
import { QualitySummary, QualityBadge } from './quality-indicator';

interface ChunkPreview {
  index: number;
  content: string;
  contentPreview: string;
  qualityScore: number;
  metadata: {
    isQAPair: boolean;
    hasHeader: boolean;
    isTable: boolean;
    isList: boolean;
  };
  autoApproved: boolean;
}

interface PreviewWarning {
  type: 'too_short' | 'too_long' | 'incomplete_qa' | 'low_quality';
  count: number;
  message: string;
}

interface PreviewData {
  structure: {
    hasQAPairs: boolean;
    hasHeaders: boolean;
    hasTables: boolean;
    hasLists: boolean;
  };
  chunks: ChunkPreview[];
  summary: {
    totalChunks: number;
    avgQualityScore: number;
    autoApprovedCount: number;
    pendingCount: number;
    warnings: PreviewWarning[];
  };
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  previewData: PreviewData | null;
  filename: string;
  isUploading: boolean;
}

export function PreviewModal({
  isOpen,
  onClose,
  onConfirm,
  previewData,
  filename,
  isUploading,
}: PreviewModalProps) {
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);

  if (!isOpen || !previewData) return null;

  const { structure, chunks, summary } = previewData;

  // 경고 아이콘 매핑
  const warningIcons: Record<PreviewWarning['type'], string> = {
    too_short: '📏',
    too_long: '📄',
    incomplete_qa: '❓',
    low_quality: '⚠️',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              업로드 미리보기
            </h2>
            <p className="text-sm text-muted-foreground">{filename}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 본문 (스크롤 가능) */}
        <div className="max-h-[calc(90vh-180px)] overflow-y-auto p-6">
          {/* 요약 카드 */}
          <QualitySummary
            totalChunks={summary.totalChunks}
            avgScore={summary.avgQualityScore}
            autoApprovedCount={summary.autoApprovedCount}
            pendingCount={summary.pendingCount}
          />

          {/* 문서 구조 분석 */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              문서 구조 분석
            </h3>
            <div className="flex flex-wrap gap-2">
              {structure.hasQAPairs && (
                <StructureBadge icon="💬" label="Q&A 형식" positive />
              )}
              {structure.hasHeaders && (
                <StructureBadge icon="📑" label="헤더 구조" positive />
              )}
              {structure.hasTables && (
                <StructureBadge icon="📊" label="테이블" />
              )}
              {structure.hasLists && (
                <StructureBadge icon="📝" label="목록" />
              )}
              {!structure.hasQAPairs &&
                !structure.hasHeaders &&
                !structure.hasTables &&
                !structure.hasLists && (
                  <StructureBadge icon="📄" label="일반 텍스트" />
                )}
            </div>
          </div>

          {/* 경고 섹션 */}
          {summary.warnings.length > 0 && (
            <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <h3 className="mb-2 text-sm font-medium text-yellow-500">
                개선 권장 사항
              </h3>
              <ul className="space-y-1">
                {summary.warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm text-yellow-500"
                  >
                    <span>{warningIcons[warning.type]}</span>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 청크 목록 */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              청크 미리보기 ({chunks.length}개)
            </h3>
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <div
                  key={chunk.index}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{chunk.index + 1}
                      </span>
                      <div className="flex gap-1">
                        {chunk.metadata.isQAPair && (
                          <ChunkTag label="Q&A" color="green" />
                        )}
                        {chunk.metadata.hasHeader && (
                          <ChunkTag label="헤더" color="blue" />
                        )}
                        {chunk.metadata.isTable && (
                          <ChunkTag label="테이블" color="purple" />
                        )}
                        {chunk.metadata.isList && (
                          <ChunkTag label="목록" color="orange" />
                        )}
                      </div>
                    </div>
                    <QualityBadge
                      score={chunk.qualityScore}
                      autoApproved={chunk.autoApproved}
                    />
                  </div>
                  <div className="mt-2">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {expandedChunk === chunk.index
                        ? chunk.content
                        : chunk.contentPreview}
                    </p>
                    {chunk.content.length > 200 && (
                      <button
                        onClick={() =>
                          setExpandedChunk(
                            expandedChunk === chunk.index ? null : chunk.index
                          )
                        }
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        {expandedChunk === chunk.index
                          ? '접기'
                          : '더 보기'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="text-sm text-muted-foreground">
            {summary.autoApprovedCount > 0 ? (
              <span className="text-green-500">
                {summary.autoApprovedCount}개 청크가 자동 승인됩니다
              </span>
            ) : (
              <span>모든 청크가 검토 대기 상태가 됩니다</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <LoadingSpinner />
                  업로드 중...
                </>
              ) : (
                <>
                  <UploadIcon />
                  업로드 진행
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 구조 배지 컴포넌트
function StructureBadge({
  icon,
  label,
  positive,
}: {
  icon: string;
  label: string;
  positive?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        positive
          ? 'bg-green-500/10 text-green-500'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}

// 청크 태그 컴포넌트
function ChunkTag({
  label,
  color,
}: {
  label: string;
  color: 'green' | 'blue' | 'purple' | 'orange';
}) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-500',
    blue: 'bg-primary/10 text-primary',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
  };

  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClasses[color]}`}
    >
      {label}
    </span>
  );
}

// 아이콘 컴포넌트들
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
