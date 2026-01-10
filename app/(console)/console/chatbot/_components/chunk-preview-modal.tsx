'use client';

/**
 * AI 청킹 결과 미리보기 모달 (2단계)
 *
 * AI 시맨틱 청킹 결과를 표시하고 업로드 진행 여부를 확인합니다.
 *
 * 2단계 플로우:
 * 1단계: 파싱 + 텍스트 미리보기 (ParsePreviewModal)
 * 2단계: AI 시맨틱 청킹 결과 (이 모달)
 */

import { useState } from 'react';
import { QualitySummary, QualityBadge } from './quality-indicator';
import type { SemanticChunk } from '@/lib/rag/semantic-chunking';

// ============================================================
// 타입
// ============================================================

interface ChunkPreview {
  index: number;
  content: string;
  contentPreview: string;
  type: SemanticChunk['type'];
  topic: string;
  qualityScore: number;
  autoApproved: boolean;
}

interface ChunkWarning {
  type: 'too_short' | 'too_long' | 'incomplete_qa' | 'low_quality';
  count: number;
  message: string;
}

interface ChunkPreviewData {
  chunks: ChunkPreview[];
  summary: {
    totalChunks: number;
    avgQualityScore: number;
    autoApprovedCount: number;
    pendingCount: number;
    warnings: ChunkWarning[];
  };
  usage: {
    pointsConsumed: number;
    processingTime: number;
    segmentCount: number;
  };
}

interface ChunkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  chunkData: ChunkPreviewData | null;
  filename: string;
  isUploading: boolean;
}

// ============================================================
// 컴포넌트
// ============================================================

export function ChunkPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  chunkData,
  filename,
  isUploading,
}: ChunkPreviewModalProps) {
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);

  if (!isOpen || !chunkData) return null;

  const { chunks, summary, usage } = chunkData;

  // 경고 아이콘 매핑
  const warningIcons: Record<ChunkWarning['type'], string> = {
    too_short: '📏',
    too_long: '📄',
    incomplete_qa: '❓',
    low_quality: '⚠️',
  };

  // 청크 타입 라벨 및 색상
  const typeConfig: Record<string, { label: string; color: string }> = {
    paragraph: { label: '문단', color: 'bg-muted text-muted-foreground' },
    qa: { label: 'Q&A', color: 'bg-green-500/10 text-green-500' },
    list: { label: '목록', color: 'bg-orange-500/10 text-orange-500' },
    table: { label: '테이블', color: 'bg-purple-500/10 text-purple-500' },
    header: { label: '헤더', color: 'bg-primary/10 text-primary' },
    code: { label: '코드', color: 'bg-yellow-500/10 text-yellow-500' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <SparkleIcon className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                청킹 결과
              </h2>
              <p className="text-sm text-muted-foreground">{filename}</p>
            </div>
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

          {/* 사용된 포인트 안내 */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">
              처리 시간: {(usage.processingTime / 1000).toFixed(1)}초 ({usage.segmentCount}세그먼트)
            </span>
            <span className="font-medium text-primary">
              사용된 포인트: {usage.pointsConsumed}P
            </span>
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
              {chunks.map((chunk) => {
                const config = typeConfig[chunk.type] || typeConfig.paragraph;
                return (
                  <div
                    key={chunk.index}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          #{chunk.index + 1}
                        </span>
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}
                        >
                          {config.label}
                        </span>
                        {chunk.topic && (
                          <span className="text-xs text-muted-foreground">
                            · {chunk.topic}
                          </span>
                        )}
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
                          {expandedChunk === chunk.index ? '접기' : '더 보기'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

// ============================================================
// 아이콘 컴포넌트
// ============================================================

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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
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
