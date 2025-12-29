'use client';

/**
 * Q&A 목록 컴포넌트
 * 개별 Q&A 항목 편집
 */

import { useMemo } from 'react';
import type { QAPair } from './utils';

interface QAListProps {
  qaPairs: QAPair[];
  onAdd: () => void;
  onUpdate: (id: string, field: 'question' | 'answer', value: string) => void;
  onDelete: (id: string) => void;
}

export function QAList({ qaPairs, onAdd, onUpdate, onDelete }: QAListProps) {
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
}

function QAItem({ qa, index, onUpdate, onDelete }: QAItemProps) {
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

  return (
    <div className="group rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          #{index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScoreColor(qualityScore)}`}
          >
            {qualityScore}점
          </span>
          <button
            onClick={() => onDelete(qa.id)}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title="삭제"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* 질문 */}
      <div className="mb-3">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <span className="text-primary">Q</span>
          질문
        </label>
        <input
          type="text"
          value={qa.question}
          onChange={(e) => onUpdate(qa.id, 'question', e.target.value)}
          placeholder="질문을 입력하세요..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 답변 */}
      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <span className="text-green-500">A</span>
          답변
        </label>
        <textarea
          value={qa.answer}
          onChange={(e) => onUpdate(qa.id, 'answer', e.target.value)}
          placeholder="답변을 입력하세요... (100~500자 권장)"
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="mt-1 flex justify-end">
          <span className="text-xs text-muted-foreground">
            {qa.answer.length}자
          </span>
        </div>
      </div>
    </div>
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
