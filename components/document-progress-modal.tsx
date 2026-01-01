'use client';

/**
 * 문서 처리 상태 모달
 * 처리 단계별 진행 상황 및 에러 표시
 * [Week 10] Stalled 상태 감지 및 정지 아이콘 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { isDocumentStalled } from '@/lib/constants/document';

interface ProcessingLog {
  id: string;
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string | null;
  details: Record<string, unknown>;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface DocumentInfo {
  id: string;
  filename: string;
  status: string;
  progressStep: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  updatedAt: string | null;
}

interface DocumentProgressModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onReprocess?: () => void;
}

const PROCESSING_STEPS = [
  { key: 'started', label: '시작됨' },
  { key: 'parsing', label: '파싱' },
  { key: 'chunking', label: '청킹' },
  { key: 'embedding', label: '임베딩 생성' },
  { key: 'quality_check', label: '품질 검사' },
  { key: 'completed', label: '완료' },
];

export function DocumentProgressModal({
  documentId,
  isOpen,
  onClose,
  onReprocess,
}: DocumentProgressModalProps) {
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/logs`);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      const data = await response.json();
      setDocument(data.document);
      setLogs(data.logs);
      setError(null);
    } catch (err) {
      setError('로그를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // 처리 중일 때 폴링
  useEffect(() => {
    if (!isOpen || !document) return;

    const isProcessing = ['uploaded', 'processing'].includes(document.status);
    if (!isProcessing) return;

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, document, fetchLogs]);

  if (!isOpen) return null;

  // 단계별 상태 판정: 동일 단계의 모든 로그를 확인하여 우선순위 기반으로 상태 결정
  // 우선순위: failed > completed > started (in_progress)
  const getStepStatus = (stepKey: string): 'pending' | 'in_progress' | 'completed' | 'failed' => {
    const stepLogs = logs.filter((log) => log.step === stepKey);
    if (stepLogs.length === 0) return 'pending';

    // 하나라도 실패하면 실패
    if (stepLogs.some((log) => log.status === 'failed')) return 'failed';
    // 완료 로그가 있으면 완료
    if (stepLogs.some((log) => log.status === 'completed')) return 'completed';
    // started만 있으면 진행 중
    return 'in_progress';
  };

  // 단계의 마지막(최신) 로그 반환
  const getStepLog = (stepKey: string) => {
    const stepLogs = logs.filter((log) => log.step === stepKey);
    return stepLogs.length > 0 ? stepLogs[stepLogs.length - 1] : undefined;
  };

  const isFailed = document?.status === 'failed';
  const isStalled = isDocumentStalled(document?.status || '', document?.updatedAt);
  const isProcessing = ['uploaded', 'processing'].includes(document?.status || '') && !isStalled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">
            {document?.filename || '문서 처리 상태'}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner className="h-8 w-8 text-primary" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : (
            <>
              {/* 프로그레스 바 */}
              {isProcessing && (
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">진행률</span>
                    <span className="font-medium text-primary">
                      {document?.progressPercent || 0}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${document?.progressPercent || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 실패 상태 표시 */}
              {isFailed && (
                <div className="mb-4 rounded-lg bg-destructive/10 p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <ErrorIcon className="h-5 w-5" />
                    <span className="font-medium">처리 실패</span>
                  </div>
                  {document?.errorMessage && (
                    <p className="mt-2 text-sm text-destructive">
                      {document.errorMessage}
                    </p>
                  )}
                </div>
              )}

              {/* 중단됨(Stalled) 상태 표시 */}
              {isStalled && (
                <div className="mb-4 rounded-lg bg-orange-500/10 p-4">
                  <div className="flex items-center gap-2 text-orange-500">
                    <PauseIcon className="h-5 w-5" />
                    <span className="font-medium">처리 중단됨</span>
                  </div>
                  <p className="mt-2 text-sm text-orange-600">
                    서버 재시작 등으로 인해 처리가 중단되었습니다. 재처리 버튼을 클릭하여 다시 시작하세요.
                  </p>
                </div>
              )}

              {/* 단계별 상태 */}
              <div className="space-y-3">
                {PROCESSING_STEPS.map((step) => {
                  const status = getStepStatus(step.key);
                  const log = getStepLog(step.key);

                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {status === 'completed' && (
                          <CheckIcon className="h-5 w-5 text-green-500" />
                        )}
                        {status === 'failed' && (
                          <ErrorIcon className="h-5 w-5 text-destructive" />
                        )}
                        {status === 'in_progress' && isStalled && (
                          <PauseIcon className="h-5 w-5 text-orange-500" />
                        )}
                        {status === 'in_progress' && !isStalled && (
                          <LoadingSpinner className="h-5 w-5 text-primary" />
                        )}
                        {status === 'pending' && (
                          <CircleIcon className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-medium ${
                              status === 'completed'
                                ? 'text-foreground'
                                : status === 'failed'
                                  ? 'text-destructive'
                                  : status === 'in_progress' && isStalled
                                    ? 'text-orange-500'
                                    : status === 'in_progress'
                                      ? 'text-primary'
                                      : 'text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </span>
                          {log?.durationMs && (
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(log.durationMs)}
                            </span>
                          )}
                        </div>
                        {log?.message && status !== 'pending' && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {log.message}
                          </p>
                        )}
                        {log?.errorMessage && (
                          <p className="mt-1 text-xs text-destructive">
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          {(isFailed || isStalled) && onReprocess && (
            <button
              onClick={() => {
                onReprocess();
                onClose();
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                isStalled
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              재처리
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}초`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}분 ${remainingSeconds.toFixed(0)}초`;
}

// 아이콘 컴포넌트들
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 9v6M14 9v6"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
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
