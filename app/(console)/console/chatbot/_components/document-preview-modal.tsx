'use client';

/**
 * 통합 문서 미리보기 모달
 *
 * 문서 업로드의 전체 플로우를 하나의 모달에서 처리합니다.
 * - Step 1 (parse): 파싱 결과 + 텍스트 미리보기
 * - Step 2 (chunking): AI 청킹 진행 중 (프로그레스바)
 * - Step 3 (chunked): 청킹 결과 미리보기
 *
 * 다이얼로그가 닫히지 않고 연속적인 UX를 제공합니다.
 */

import { useState } from 'react';
import { QualitySummary, QualityBadge } from './quality-indicator';
import { formatEstimatedTime } from '@/lib/rag/chunk-cost-estimator';
import type { SemanticChunk } from '@/lib/rag/semantic-chunking';

// ============================================================
// 타입
// ============================================================

// 파싱 결과 (1단계)
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

// 청킹 결과 (3단계)
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

// 업로드 상태 타입 (document-upload.tsx와 동일하게 유지)
export type UploadState =
  | { status: 'idle' }
  | { status: 'parsing'; message: string }
  | { status: 'parsed'; parseData: ParsePreviewData }
  | { status: 'chunking'; progress: number; message: string }
  | { status: 'chunked'; chunkData: ChunkPreviewData }
  | { status: 'uploading'; progress: number }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmUpload: () => void;
  uploadState: UploadState;
  onStartChunking: () => void;
  filename: string;
  currentBalance: number;
  isUploading?: boolean;
}

// ============================================================
// 메인 컴포넌트
// ============================================================

export function DocumentPreviewModal({
  isOpen,
  onClose,
  onConfirmUpload,
  uploadState,
  onStartChunking,
  filename,
  currentBalance,
  isUploading = false,
}: DocumentPreviewModalProps) {
  const [showFullText, setShowFullText] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);

  // 모달 열림 조건: parsed, chunking, chunked 상태일 때만
  const shouldShow =
    isOpen &&
    (uploadState.status === 'parsed' ||
      uploadState.status === 'chunking' ||
      uploadState.status === 'chunked');

  if (!shouldShow) return null;

  // 현재 단계 결정
  const currentStep = uploadState.status as 'parsed' | 'chunking' | 'chunked';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={currentStep !== 'chunking' ? onClose : undefined}
      />

      {/* 모달 */}
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {/* Step 1: 파싱 결과 */}
        {currentStep === 'parsed' && (
          <ParseStep
            parseData={(uploadState as { status: 'parsed'; parseData: ParsePreviewData }).parseData}
            filename={filename}
            currentBalance={currentBalance}
            showFullText={showFullText}
            setShowFullText={setShowFullText}
            onClose={onClose}
            onStartChunking={onStartChunking}
          />
        )}

        {/* Step 2: 청킹 진행 중 */}
        {currentStep === 'chunking' && (
          <ChunkingStep
            progress={(uploadState as { status: 'chunking'; progress: number; message: string }).progress}
            message={(uploadState as { status: 'chunking'; progress: number; message: string }).message}
            filename={filename}
            onCancel={onClose}
          />
        )}

        {/* Step 3: 청킹 결과 */}
        {currentStep === 'chunked' && (
          <ChunkedStep
            chunkData={(uploadState as { status: 'chunked'; chunkData: ChunkPreviewData }).chunkData}
            filename={filename}
            expandedChunk={expandedChunk}
            setExpandedChunk={setExpandedChunk}
            onClose={onClose}
            onConfirmUpload={onConfirmUpload}
            isUploading={isUploading}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Step 1: 파싱 결과 컴포넌트
// ============================================================

interface ParseStepProps {
  parseData: ParsePreviewData;
  filename: string;
  currentBalance: number;
  showFullText: boolean;
  setShowFullText: (show: boolean) => void;
  onClose: () => void;
  onStartChunking: () => void;
}

function ParseStep({
  parseData,
  filename,
  currentBalance,
  showFullText,
  setShowFullText,
  onClose,
  onStartChunking,
}: ParseStepProps) {
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
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <DocumentIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">문서 미리보기</h2>
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
          <h3 className="mb-3 text-sm font-medium text-foreground">문서 구조 분석</h3>
          <div className="flex flex-wrap gap-2">
            {structure.hasQAPairs && <StructureBadge icon="✅" label="Q&A 형식" positive />}
            {structure.hasHeaders && <StructureBadge icon="✅" label="헤더 구조" positive />}
            {structure.hasTables && <StructureBadge icon="📊" label="테이블" />}
            {structure.hasLists && <StructureBadge icon="📝" label="목록" />}
            {!structure.hasQAPairs &&
              !structure.hasHeaders &&
              !structure.hasTables &&
              !structure.hasLists && <StructureBadge icon="📄" label="일반 텍스트" />}
          </div>
        </div>

        {/* 추출된 텍스트 */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-foreground">추출된 텍스트</h3>
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
              <div className="text-2xl font-bold text-foreground">~{estimation.estimatedChunks}개</div>
              <div className="mt-1 text-xs text-muted-foreground">예상 청크 수</div>
            </div>
            <div className="rounded-lg bg-card p-3 text-center">
              <div className="text-2xl font-bold text-primary">{estimation.estimatedPoints}P</div>
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
        <div className="text-sm text-muted-foreground">파싱 완료 ({metadata.parseTime}ms)</div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            취소
          </button>
          <button
            onClick={onStartChunking}
            disabled={!hasEnoughPoints}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <SparkleIcon className="h-4 w-4" />
            AI 청킹 진행 ({estimation.estimatedPoints}P)
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Step 2: 청킹 진행 중 컴포넌트
// ============================================================

interface ChunkingStepProps {
  progress: number;
  message: string;
  filename: string;
  onCancel: () => void;
}

function ChunkingStep({ progress, message, filename, onCancel }: ChunkingStepProps) {
  // 예상 남은 시간 계산 (대략적)
  const estimatedRemainingSeconds = progress > 0 ? Math.ceil(((100 - progress) / progress) * 2) : null;

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <SparkleIcon className="h-5 w-5 animate-pulse text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">AI 청킹 진행 중</h2>
            <p className="text-sm text-muted-foreground">{filename}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <CloseIcon />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-background p-8">
          {/* 파일 아이콘 */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <DocumentIcon className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* 프로그레스바 */}
          <div className="space-y-2">
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{Math.round(progress)}%</span>
              {estimatedRemainingSeconds !== null && estimatedRemainingSeconds > 0 && (
                <span className="text-muted-foreground">~{estimatedRemainingSeconds}초 남음</span>
              )}
            </div>
          </div>

          {/* 상태 메시지 */}
          <p className="text-center text-sm text-muted-foreground">{message}</p>
        </div>

        {/* 안내 텍스트 */}
        <p className="mt-6 max-w-sm text-center text-sm text-muted-foreground">
          💡 AI가 문서를 의미 단위로 분석하고 있습니다. 각 청크의 품질 점수도 함께 계산됩니다.
        </p>
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-center border-t border-border px-6 py-4">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          청킹 취소
        </button>
      </div>
    </>
  );
}

// ============================================================
// Step 3: 청킹 결과 컴포넌트
// ============================================================

interface ChunkedStepProps {
  chunkData: ChunkPreviewData;
  filename: string;
  expandedChunk: number | null;
  setExpandedChunk: (index: number | null) => void;
  onClose: () => void;
  onConfirmUpload: () => void;
  isUploading: boolean;
}

function ChunkedStep({
  chunkData,
  filename,
  expandedChunk,
  setExpandedChunk,
  onClose,
  onConfirmUpload,
  isUploading,
}: ChunkedStepProps) {
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
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <CheckIcon className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">청킹 완료</h2>
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
          <span className="font-medium text-primary">사용된 포인트: {usage.pointsConsumed}P</span>
        </div>

        {/* 경고 섹션 */}
        {summary.warnings.length > 0 && (
          <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <h3 className="mb-2 text-sm font-medium text-yellow-500">개선 권장 사항</h3>
            <ul className="space-y-1">
              {summary.warnings.map((warning, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-yellow-500">
                  <span>{warningIcons[warning.type]}</span>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 청크 목록 */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-foreground">청크 미리보기 ({chunks.length}개)</h3>
          <div className="space-y-3">
            {chunks.map((chunk) => {
              const config = typeConfig[chunk.type] || typeConfig.paragraph;
              return (
                <div key={chunk.index} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">#{chunk.index + 1}</span>
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}
                      >
                        {config.label}
                      </span>
                      {chunk.topic && (
                        <span className="text-xs text-muted-foreground">· {chunk.topic}</span>
                      )}
                    </div>
                    <QualityBadge score={chunk.qualityScore} autoApproved={chunk.autoApproved} />
                  </div>
                  <div className="mt-2">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {expandedChunk === chunk.index ? chunk.content : chunk.contentPreview}
                    </p>
                    {chunk.content.length > 200 && (
                      <button
                        onClick={() =>
                          setExpandedChunk(expandedChunk === chunk.index ? null : chunk.index)
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
            <span className="text-green-500">{summary.autoApprovedCount}개 청크가 자동 승인됩니다</span>
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
            onClick={onConfirmUpload}
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
    </>
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
        positive ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

// ============================================================
// Export 타입들 (document-upload.tsx에서 사용)
// ============================================================

export type { ParsePreviewData, ChunkPreviewData, ChunkPreview, ChunkWarning };
