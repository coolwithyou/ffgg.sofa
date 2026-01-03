'use client';

/**
 * 채팅 진행 상태 인디케이터
 *
 * 채널톡 ALF 스타일의 단계별 진행 상태 표시
 * Server Actions 아키텍처에 맞게 시뮬레이션 기반으로 동작
 */

import { useEffect, useState } from 'react';
import { Check, Loader2, Circle } from 'lucide-react';

/**
 * 진행 단계 정의
 */
interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'complete';
  duration: number; // ms
}

/**
 * 기본 진행 단계 설정
 */
const DEFAULT_STEPS: Array<{ id: string; label: string; duration: number }> = [
  { id: 'query_analysis', label: '질문 분석 중...', duration: 300 },
  { id: 'searching', label: '관련 문서 검색 중...', duration: 600 },
  { id: 'reranking', label: '검색 결과 정렬 중...', duration: 400 },
  { id: 'generating', label: '답변 생성 중...', duration: 800 },
];

interface ProgressIndicatorProps {
  /**
   * 진행 중 여부. false가 되면 모든 단계를 complete로 표시
   */
  isLoading: boolean;
  /**
   * 테마 컬러
   */
  primaryColor?: string;
  /**
   * 컴팩트 모드 (작은 크기)
   */
  compact?: boolean;
}

/**
 * 진행 상태 인디케이터 컴포넌트
 */
export function ProgressIndicator({
  isLoading,
  primaryColor = '#3b82f6',
  compact = false,
}: ProgressIndicatorProps) {
  const [steps, setSteps] = useState<ProgressStep[]>(
    DEFAULT_STEPS.map((s) => ({
      ...s,
      status: 'pending' as const,
    }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // 로딩 시작 시 단계 진행
  useEffect(() => {
    if (!isLoading) {
      // 로딩 종료: 모든 단계 완료 처리
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: 'complete' as const,
        }))
      );
      return;
    }

    // 로딩 시작: 단계 초기화
    setCurrentStepIndex(0);
    setSteps(
      DEFAULT_STEPS.map((s, i) => ({
        ...s,
        status: i === 0 ? ('in_progress' as const) : ('pending' as const),
      }))
    );
  }, [isLoading]);

  // 단계 자동 진행
  useEffect(() => {
    if (!isLoading || currentStepIndex >= DEFAULT_STEPS.length) return;

    const currentDuration = DEFAULT_STEPS[currentStepIndex].duration;
    const timer = setTimeout(() => {
      setSteps((prev) =>
        prev.map((step, i) => {
          if (i < currentStepIndex + 1) {
            return { ...step, status: 'complete' as const };
          }
          if (i === currentStepIndex + 1) {
            return { ...step, status: 'in_progress' as const };
          }
          return step;
        })
      );
      setCurrentStepIndex((prev) => prev + 1);
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [isLoading, currentStepIndex]);

  // 모든 단계가 완료되면 마지막 단계를 in_progress로 유지 (로딩 중일 때)
  useEffect(() => {
    if (isLoading && currentStepIndex >= DEFAULT_STEPS.length) {
      setSteps((prev) =>
        prev.map((step, i) =>
          i === prev.length - 1
            ? { ...step, status: 'in_progress' as const }
            : step
        )
      );
    }
  }, [isLoading, currentStepIndex]);

  const iconSize = compact ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const gapSize = compact ? 'gap-1.5' : 'gap-2';
  const spaceY = compact ? 'space-y-1' : 'space-y-2';

  return (
    <div className={`${spaceY} text-muted-foreground`}>
      {steps.map((step) => (
        <div key={step.id} className={`flex items-center ${gapSize}`}>
          {step.status === 'complete' ? (
            <Check
              className={`${iconSize} text-green-500`}
              style={{ color: primaryColor }}
            />
          ) : step.status === 'in_progress' ? (
            <Loader2
              className={`${iconSize} animate-spin`}
              style={{ color: primaryColor }}
            />
          ) : (
            <Circle className={`${iconSize} text-muted-foreground/50`} />
          )}
          <span
            className={`${textSize} ${
              step.status === 'in_progress' ? 'text-foreground' : ''
            }`}
          >
            {step.status === 'complete'
              ? step.label.replace('...', '')
              : step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 인라인 진행 상태 (한 줄 버전)
 */
export function InlineProgressIndicator({
  isLoading,
  primaryColor = '#3b82f6',
}: {
  isLoading: boolean;
  primaryColor?: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [displayText, setDisplayText] = useState(DEFAULT_STEPS[0].label);

  useEffect(() => {
    if (!isLoading) {
      setDisplayText('답변 완료');
      return;
    }

    setCurrentStep(0);
    setDisplayText(DEFAULT_STEPS[0].label);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading || currentStep >= DEFAULT_STEPS.length) return;

    const timer = setTimeout(() => {
      const nextStep = currentStep + 1;
      if (nextStep < DEFAULT_STEPS.length) {
        setDisplayText(DEFAULT_STEPS[nextStep].label);
        setCurrentStep(nextStep);
      }
    }, DEFAULT_STEPS[currentStep].duration);

    return () => clearTimeout(timer);
  }, [isLoading, currentStep]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {isLoading ? (
        <Loader2
          className="h-4 w-4 animate-spin"
          style={{ color: primaryColor }}
        />
      ) : (
        <Check className="h-4 w-4 text-green-500" />
      )}
      <span>{displayText}</span>
    </div>
  );
}
