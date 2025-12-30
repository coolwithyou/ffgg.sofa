'use client';

/**
 * Q&A 목록 컴포넌트
 * 개별 Q&A 항목 편집 및 문서 업로드 관리
 */

import { useMemo } from 'react';
import type { QAPair } from './utils';

// 입력 길이 제한 (actions.ts와 동일)
const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 5000;

interface QAListProps {
  qaPairs: QAPair[];
  onAdd: () => void;
  onUpdate: (id: string, field: 'question' | 'answer', value: string) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string) => void;
  onUnlock: (id: string) => void;
  uploadingQAId: string | null;
}

export function QAList({
  qaPairs,
  onAdd,
  onUpdate,
  onDelete,
  onUpload,
  onUnlock,
  uploadingQAId,
}: QAListProps) {
  const sortedQAPairs = useMemo(
    () => [...qaPairs].sort((a, b) => a.order - b.order),
    [qaPairs]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <h3 className="text-sm font-medium text-foreground">
          Q&A 목록 ({qaPairs.length}개)
        </h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
        >
          <PlusIcon />
          Q&A 추가
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sortedQAPairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <QuestionIcon className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              Q&A가 없습니다
            </p>
            <button
              onClick={onAdd}
              className="mt-2 text-sm text-primary hover:underline"
            >
              첫 Q&A 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedQAPairs.map((qa, index) => (
              <QAItem
                key={qa.id}
                qa={qa}
                index={index}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onUpload={onUpload}
                onUnlock={onUnlock}
                isUploading={uploadingQAId === qa.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface QAItemProps {
  qa: QAPair;
  index: number;
  onUpdate: (id: string, field: 'question' | 'answer', value: string) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string) => void;
  onUnlock: (id: string) => void;
  isUploading: boolean;
}

function QAItem({
  qa,
  index,
  onUpdate,
  onDelete,
  onUpload,
  onUnlock,
  isUploading,
}: QAItemProps) {
  // 품질 점수 계산 (간단한 휴리스틱)
  const qualityScore = useMemo(() => {
    let score = 50; // 기본 점수

    // Q&A 쌍이면 +10
    if (qa.question && qa.answer) score += 10;

    // 답변 길이 (100~500자 권장)
    const answerLength = qa.answer.length;
    if (answerLength >= 100 && answerLength <= 500) {
      score += 20;
    } else if (answerLength > 50 && answerLength < 800) {
      score += 10;
    }

    // 질문 끝에 ? 있으면 +5
    if (qa.question.trim().endsWith('?')) score += 5;

    // 답변이 완전한 문장이면 +5
    if (qa.answer.trim().match(/[.!?]$/)) score += 5;

    return Math.min(100, Math.max(0, score));
  }, [qa.question, qa.answer]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-500 bg-green-500/10';
    if (score >= 70) return 'text-yellow-500 bg-yellow-500/10';
    if (score >= 50) return 'text-orange-500 bg-orange-500/10';
    return 'text-destructive bg-destructive/10';
  };

  // 잠금 상태에서는 편집 불가
  const isEditable = !qa.isLocked;

  return (
    <div
      className={`group rounded-lg border bg-card p-4 ${
        qa.isLocked && !qa.isModified
          ? 'border-green-500/30'
          : qa.isModified
            ? 'border-yellow-500/30'
            : 'border-border'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            #{index + 1}
          </span>
          <QAStatusBadge qa={qa} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScoreColor(qualityScore)}`}
          >
            {qualityScore}점
          </span>
          <QAActionButtons
            qa={qa}
            onUpload={() => onUpload(qa.id)}
            onUnlock={() => onUnlock(qa.id)}
            isUploading={isUploading}
          />
          {!qa.isLocked && (
            <button
              onClick={() => onDelete(qa.id)}
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              title="삭제"
              aria-label="Q&A 삭제"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* 질문 */}
      <div className="mb-3">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <span className="text-primary">Q</span>
          질문
          {qa.isLocked && <LockIcon className="ml-1 h-3 w-3" />}
        </label>
        <input
          type="text"
          value={qa.question}
          onChange={(e) => onUpdate(qa.id, 'question', e.target.value)}
          placeholder="질문을 입력하세요..."
          disabled={!isEditable}
          maxLength={MAX_QUESTION_LENGTH}
          className={`w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
            !isEditable
              ? 'cursor-not-allowed bg-muted/50'
              : 'bg-background'
          } ${qa.question.length > MAX_QUESTION_LENGTH ? 'border-destructive' : ''}`}
        />
        <div className="mt-1 flex justify-end">
          <span
            className={`text-xs ${
              qa.question.length > MAX_QUESTION_LENGTH
                ? 'text-destructive'
                : qa.question.length > MAX_QUESTION_LENGTH * 0.9
                  ? 'text-yellow-500'
                  : 'text-muted-foreground'
            }`}
          >
            {qa.question.length}/{MAX_QUESTION_LENGTH}자
          </span>
        </div>
      </div>

      {/* 답변 */}
      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <span className="text-green-500">A</span>
          답변
          {qa.isLocked && <LockIcon className="ml-1 h-3 w-3" />}
        </label>
        <textarea
          value={qa.answer}
          onChange={(e) => onUpdate(qa.id, 'answer', e.target.value)}
          placeholder="답변을 입력하세요... (100~500자 권장)"
          rows={3}
          disabled={!isEditable}
          maxLength={MAX_ANSWER_LENGTH}
          className={`w-full resize-none rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
            !isEditable
              ? 'cursor-not-allowed bg-muted/50'
              : 'bg-background'
          } ${qa.answer.length > MAX_ANSWER_LENGTH ? 'border-destructive' : ''}`}
        />
        <div className="mt-1 flex items-center justify-between">
          {qa.uploadedAt && (
            <span className="text-xs text-muted-foreground">
              업로드: {(() => {
                try {
                  return new Date(qa.uploadedAt).toLocaleDateString('ko-KR');
                } catch {
                  return qa.uploadedAt;
                }
              })()}
            </span>
          )}
          <span
            className={`ml-auto text-xs ${
              qa.answer.length > MAX_ANSWER_LENGTH
                ? 'text-destructive'
                : qa.answer.length > MAX_ANSWER_LENGTH * 0.9
                  ? 'text-yellow-500'
                  : 'text-muted-foreground'
            }`}
          >
            {qa.answer.length}/{MAX_ANSWER_LENGTH}자
          </span>
        </div>
      </div>
    </div>
  );
}

// 상태 배지 컴포넌트
function QAStatusBadge({ qa }: { qa: QAPair }) {
  if (qa.isLocked && !qa.isModified) {
    // 업로드됨 + 잠금 (초록색)
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
        <CheckIcon className="h-3 w-3" />
        업로드됨
      </span>
    );
  }
  if (qa.isModified) {
    // 수정됨 (노란색)
    return (
      <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
        <WarningIcon className="h-3 w-3" />
        수정됨
      </span>
    );
  }
  return null; // 미업로드 상태는 배지 없음
}

// 액션 버튼 컴포넌트
function QAActionButtons({
  qa,
  onUpload,
  onUnlock,
  isUploading,
}: {
  qa: QAPair;
  onUpload: () => void;
  onUnlock: () => void;
  isUploading: boolean;
}) {
  if (isUploading) {
    return (
      <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
        <LoadingIcon className="h-3 w-3 animate-spin" />
        업로드 중...
      </span>
    );
  }

  if (qa.isLocked && !qa.isModified) {
    // 잠금 해제 버튼
    return (
      <button
        onClick={onUnlock}
        className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        title="잠금 해제하여 편집"
      >
        <UnlockIcon className="h-3 w-3" />
        잠금 해제
      </button>
    );
  }

  if (qa.isModified) {
    // 재업로드 버튼
    return (
      <button
        onClick={onUpload}
        className="flex items-center gap-1 rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-500 hover:bg-yellow-500/20"
        title="수정된 내용으로 재업로드"
      >
        <RefreshIcon className="h-3 w-3" />
        재업로드
      </button>
    );
  }

  // 첫 업로드 버튼
  return (
    <button
      onClick={onUpload}
      className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
      title="문서로 업로드"
    >
      <UploadIcon className="h-3 w-3" />
      문서 업로드
    </button>
  );
}

// 아이콘 컴포넌트들
function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

function UnlockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
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

function WarningIcon({ className }: { className?: string }) {
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
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
