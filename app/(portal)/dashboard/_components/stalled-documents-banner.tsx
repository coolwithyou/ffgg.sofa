'use client';

/**
 * 중단된 문서 경고 배너
 * [Week 10] Stalled 문서 표시 및 재시작 기능
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { reprocessDocument } from '@/app/(portal)/documents/actions';
import { useRouter } from 'next/navigation';

interface StalledDocument {
  id: string;
  filename: string;
  status: 'processing' | 'uploaded';
  progressStep: string | null;
  progressPercent: number | null;
  createdAt: string;
  updatedAt: string | null;
}

interface StalledDocumentsBannerProps {
  documents: StalledDocument[];
}

export function StalledDocumentsBanner({ documents }: StalledDocumentsBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set());
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());

  const handleReprocess = async (documentId: string) => {
    setReprocessingIds((prev) => new Set(prev).add(documentId));

    startTransition(async () => {
      const result = await reprocessDocument(documentId);

      if (result.success) {
        setSuccessIds((prev) => new Set(prev).add(documentId));
        // 1초 후 페이지 새로고침
        setTimeout(() => {
          router.refresh();
        }, 1000);
      }

      setReprocessingIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    });
  };

  const handleReprocessAll = async () => {
    for (const doc of documents) {
      if (!successIds.has(doc.id)) {
        await handleReprocess(doc.id);
      }
    }
  };

  // 모든 문서가 성공적으로 재시작되었으면 배너 숨기기
  const remainingDocs = documents.filter((doc) => !successIds.has(doc.id));
  if (remainingDocs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertIcon className="h-4 w-4 text-orange-500" />
          <h2 className="font-medium text-foreground">
            문서 처리 중단됨 ({remainingDocs.length}건)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReprocessAll}
            disabled={isPending}
            className="rounded-md bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isPending ? '재시작 중...' : '모두 재시작'}
          </button>
          <Link
            href="/documents"
            className="text-sm text-orange-600 hover:text-orange-500"
          >
            문서 관리 →
          </Link>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        서버 재시작 등으로 인해 문서 처리가 중단되었습니다. 재시작 버튼을 클릭하여 처리를 재개하세요.
      </p>

      <div className="space-y-2">
        {remainingDocs.map((doc) => {
          const isReprocessing = reprocessingIds.has(doc.id);
          const isSuccess = successIds.has(doc.id);

          return (
            <div key={doc.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {doc.filename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {doc.progressStep ? `${doc.progressStep} 단계에서 중단` : '처리 시작 전 중단'}
                  {doc.progressPercent != null && ` (${doc.progressPercent}%)`}
                </span>
              </div>
              <button
                onClick={() => handleReprocess(doc.id)}
                disabled={isReprocessing || isSuccess}
                className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-500/20 disabled:opacity-50"
              >
                {isReprocessing ? (
                  <span className="flex items-center gap-1">
                    <LoadingSpinner className="h-3 w-3" />
                    재시작 중
                  </span>
                ) : isSuccess ? (
                  '재시작됨'
                ) : (
                  '재시작'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
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
