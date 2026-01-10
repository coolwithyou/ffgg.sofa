'use client';

/**
 * 문서 파싱 미리보기 모달 (1단계)
 *
 * 문서 파싱 결과와 추출된 텍스트를 미리 표시합니다.
 * AI 청킹 비용 안내와 함께 사용자 동의를 받습니다.
 *
 * 2단계 플로우:
 * 1단계: 파싱 + 텍스트 미리보기 (이 모달) - AI 없음, 빠름
 * 2단계: AI 시맨틱 청킹 (ChunkPreviewModal) - 포인트 소모
 */

import { useState } from 'react';
import { formatEstimatedTime } from '@/lib/rag/chunk-cost-estimator';

// ============================================================
// 타입
// ============================================================

interface ParsePreviewData {
  text: string;
  textLength: number;
  structure: {
    hasQAPairs: boolean;
    hasHeaders: boolean;
    hasTables: boolean;
    hasLists: boolean;
  };
  documentType: 'faq' | 'technical' | 'legal' | 'general';
  metadata: {
    filename: string;
    fileType: string;
    fileSize: number;
    parseTime: number;
  };
  estimation: {
    estimatedChunks: number;
    estimatedPoints: number;
    estimatedTime: number;
    segmentCount: number;
  };
}

interface ParsePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  parseData: ParsePreviewData | null;
  currentBalance: number;
  isProcessing: boolean;
}

// ============================================================
// 컴포넌트
// ============================================================

export function ParsePreviewModal({
  isOpen,
  onClose,
  onProceed,
  parseData,
  currentBalance,
  isProcessing,
}: ParsePreviewModalProps) {
  const [showFullText, setShowFullText] = useState(false);

  if (!isOpen || !parseData) return null;

  const { text, textLength, structure, documentType, metadata, estimation } = parseData;
  const hasEnoughPoints = currentBalance >= estimation.estimatedPoints;

  // 문서 유형 라벨
  const documentTypeLabels: Record<string, string> = {
    faq: 'FAQ',
    technical: '기술 문서',
    legal: '법률/약관',
    general: '일반 문서',
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 텍스트 미리보기 (처음 1000자)
  const textPreview = text.length > 1000 ? text.slice(0, 1000) : text;
  const displayText = showFullText ? text : textPreview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DocumentIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                문서 미리보기
              </h2>
              <p className="text-sm text-muted-foreground">{metadata.filename}</p>
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
          {/* 파일 정보 */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
              <FileIcon className="h-3.5 w-3.5" />
              {formatFileSize(metadata.fileSize)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
              <TextIcon className="h-3.5 w-3.5" />
              {textLength.toLocaleString()}자
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-primary">
              {documentTypeLabels[documentType]}
            </span>
          </div>

          {/* 문서 구조 분석 */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              문서 구조 분석
            </h3>
            <div className="flex flex-wrap gap-2">
              {structure.hasQAPairs && (
                <StructureBadge icon="✅" label="Q&A 형식" positive />
              )}
              {structure.hasHeaders && (
                <StructureBadge icon="✅" label="헤더 구조" positive />
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

          {/* 추출된 텍스트 */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              추출된 텍스트
            </h3>
            <div className="rounded-lg border border-border bg-background p-4">
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                {displayText}
                {!showFullText && text.length > 1000 && '...'}
              </pre>
              {text.length > 1000 && (
                <button
                  onClick={() => setShowFullText(!showFullText)}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  {showFullText ? '접기' : `전체 보기 (${textLength.toLocaleString()}자)`}
                </button>
              )}
            </div>
          </div>

          {/* AI 청킹 비용 안내 */}
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <SparkleIcon className="h-5 w-5" />
              <h3 className="font-medium">AI 청킹 비용 안내</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              이 문서를 AI로 분석하여 의미 단위로 청크를 생성합니다.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-card p-3 text-center">
                <div className="text-2xl font-bold text-foreground">
                  ~{estimation.estimatedChunks}개
                </div>
                <div className="mt-1 text-xs text-muted-foreground">예상 청크 수</div>
              </div>
              <div className="rounded-lg bg-card p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {estimation.estimatedPoints}P
                </div>
                <div className="mt-1 text-xs text-muted-foreground">예상 포인트</div>
              </div>
              <div className="rounded-lg bg-card p-3 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {formatEstimatedTime(estimation.estimatedTime)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">예상 처리 시간</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">현재 보유 포인트</span>
              <span className={hasEnoughPoints ? 'text-foreground' : 'text-destructive'}>
                {currentBalance.toLocaleString()}P
              </span>
            </div>
            {!hasEnoughPoints && (
              <div className="mt-3 rounded-md bg-destructive/10 p-2 text-center text-sm text-destructive">
                포인트가 부족합니다. 청킹을 진행하려면 포인트를 충전해주세요.
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="text-sm text-muted-foreground">
            파싱 완료 ({metadata.parseTime}ms)
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={onProceed}
              disabled={isProcessing || !hasEnoughPoints}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner />
                  AI 청킹 중...
                </>
              ) : (
                <>
                  <SparkleIcon className="h-4 w-4" />
                  AI 청킹 진행 ({estimation.estimatedPoints}P)
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
// 헬퍼 컴포넌트
// ============================================================

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

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

function TextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7"
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
