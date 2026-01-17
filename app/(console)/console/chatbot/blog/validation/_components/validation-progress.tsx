// app/(console)/console/chatbot/blog/validation/_components/validation-progress.tsx

'use client';

import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import type { ProcessingStep } from '@/lib/knowledge-pages/types';

interface ValidationProgressProps {
  currentStep: ProcessingStep | null;
  completedSteps: number;
  totalSteps: number;
  totalClaims?: number;
  processedClaims?: number;
}

const STEP_LABELS: Record<ProcessingStep, string> = {
  reconstruct: '마크다운 재구성',
  extract: 'Claim 추출',
  regex: 'Regex 검증',
  llm: 'LLM 검증',
  complete: '완료',
};

const STEP_ORDER: ProcessingStep[] = ['reconstruct', 'extract', 'regex', 'llm'];

/**
 * 검증 진행 상태 표시 컴포넌트
 *
 * 4단계 진행 상태를 시각적으로 표시:
 * 1. 마크다운 재구성
 * 2. Claim 추출
 * 3. Regex 검증
 * 4. LLM 검증
 */
export function ValidationProgress({
  currentStep,
  completedSteps,
  totalSteps,
  totalClaims,
  processedClaims,
}: ValidationProgressProps) {
  // 현재 단계 인덱스 계산
  const currentStepIndex = currentStep ? STEP_ORDER.indexOf(currentStep) : -1;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* 진행률 바 */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {currentStep === 'complete'
              ? '검증 완료'
              : currentStep
                ? `${STEP_LABELS[currentStep]} 중...`
                : '대기 중...'}
          </span>
          <span className="text-muted-foreground">
            {completedSteps}/{totalSteps} 단계
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* 단계별 표시 */}
      <div className="grid grid-cols-4 gap-2">
        {STEP_ORDER.map((step, index) => {
          const isCompleted = index < completedSteps;
          const isCurrent = index === currentStepIndex;

          return (
            <div
              key={step}
              className={cn(
                'flex flex-col items-center rounded-md p-2 text-center transition-colors',
                isCompleted && 'bg-green-500/10',
                isCurrent && 'bg-primary/10'
              )}
            >
              {/* 상태 아이콘 */}
              <div
                className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && 'bg-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>

              {/* 단계 이름 */}
              <span
                className={cn(
                  'text-xs',
                  isCompleted && 'font-medium text-green-600 dark:text-green-400',
                  isCurrent && 'font-medium text-primary',
                  !isCompleted && !isCurrent && 'text-muted-foreground'
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Claim 처리 현황 (검증 단계에서만 표시) */}
      {(currentStep === 'regex' || currentStep === 'llm') &&
        totalClaims !== undefined &&
        processedClaims !== undefined && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Claim 검증 진행</span>
              <span>
                {processedClaims}/{totalClaims}개
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{
                  width: totalClaims > 0 ? `${(processedClaims / totalClaims) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        )}
    </div>
  );
}
