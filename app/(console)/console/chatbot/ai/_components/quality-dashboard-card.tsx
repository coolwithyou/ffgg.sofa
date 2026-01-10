'use client';

/**
 * Phase 5: 품질 대시보드 카드
 *
 * 청킹 전략별 품질 메트릭과 A/B 테스트 결과를 시각화합니다.
 *
 * @see docs/testplans/phase5-ab-test-quality-validation.md
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type {
  QualityMetricsResponse,
  QualityMetrics,
  ABTestResult,
  ABTestRecommendation,
} from '@/types/experiment';
import {
  QUALITY_GRADE_LABELS,
  RECOMMENDATION_MESSAGES,
} from '@/lib/rag/quality-metrics';

interface QualityDashboardCardProps {
  chatbotId: string;
}

/**
 * 품질 대시보드 카드 컴포넌트
 *
 * 챗봇의 청킹 품질 메트릭을 조회하고 시각화합니다.
 * A/B 테스트가 진행 중인 경우 대조군/처리군 비교 결과도 표시합니다.
 */
export function QualityDashboardCard({ chatbotId }: QualityDashboardCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<QualityMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setIsRefreshing(!showLoader);
    setError(null);

    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/quality-metrics`);
      if (!response.ok) {
        throw new Error('품질 메트릭을 불러올 수 없습니다');
      }
      const result: QualityMetricsResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error('Quality metrics fetch error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [chatbotId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleRefresh = () => {
    fetchMetrics(false);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <Card size="md" className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Card size="md" className="border-destructive/20 bg-destructive/5">
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchMetrics()}>
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 데이터 없음 상태
  if (!data || data.metrics.length === 0) {
    return (
      <Card size="md" className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <CardTitle>청킹 품질 대시보드</CardTitle>
          </div>
          <CardDescription>
            문서 청킹 품질 메트릭 및 A/B 테스트 결과
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              아직 품질 데이터가 없습니다
            </p>
            <p className="text-xs text-muted-foreground">
              문서를 업로드하면 품질 메트릭이 표시됩니다
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="md" className="border-blue-500/20 bg-blue-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <CardTitle>청킹 품질 대시보드</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription>
          문서 청킹 품질 메트릭 및 A/B 테스트 결과
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* A/B 테스트 결과 (있는 경우) */}
        {data.abTestResult && (
          <ABTestResultSection result={data.abTestResult} />
        )}

        {/* 전략별 품질 메트릭 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">전략별 품질 현황</h4>
          {data.metrics.map((metric, idx) => (
            <StrategyMetricRow key={idx} metric={metric} />
          ))}
        </div>

        {/* 조회 시간 */}
        <p className="text-xs text-muted-foreground">
          마지막 업데이트: {new Date(data.queriedAt).toLocaleString('ko-KR')}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * A/B 테스트 결과 섹션
 */
function ABTestResultSection({ result }: { result: ABTestResult }) {
  const { recommendation, qualityDelta, qualityDeltaPercent, isSignificant, hasEnoughData } = result;

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">A/B 테스트 결과</h4>
        <RecommendationBadge recommendation={recommendation} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* 대조군 (Smart) */}
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">대조군 (Smart)</p>
          <p className="text-xl font-bold text-foreground">
            {result.controlMetrics.avgQualityScore}점
          </p>
          <p className="text-xs text-muted-foreground">
            {result.controlMetrics.totalChunks}개 청크
          </p>
        </div>

        {/* 처리군 (Semantic) */}
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">처리군 (Semantic)</p>
          <p className="text-xl font-bold text-foreground">
            {result.treatmentMetrics.avgQualityScore}점
          </p>
          <p className="text-xs text-muted-foreground">
            {result.treatmentMetrics.totalChunks}개 청크
          </p>
        </div>
      </div>

      {/* 품질 차이 */}
      <div className="mt-4 flex items-center gap-3">
        <DeltaIndicator delta={qualityDelta} />
        <div>
          <p className="text-sm text-foreground">
            품질 점수 차이: <strong>{qualityDelta > 0 ? '+' : ''}{qualityDelta}점</strong>
            <span className="ml-1 text-muted-foreground">
              ({qualityDeltaPercent > 0 ? '+' : ''}{qualityDeltaPercent}%)
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {isSignificant ? '통계적으로 유의미한 차이' : '유의미한 차이 없음'}
            {!hasEnoughData && ' (최소 샘플 미달)'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 권장 조치 배지
 */
function RecommendationBadge({ recommendation }: { recommendation: ABTestRecommendation }) {
  const config: Record<ABTestRecommendation, { icon: React.ReactNode; className: string }> = {
    adopt_treatment: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: 'bg-green-500/10 text-green-500',
    },
    keep_control: {
      icon: <Minus className="h-4 w-4" />,
      className: 'bg-muted text-muted-foreground',
    },
    need_more_data: {
      icon: <Clock className="h-4 w-4" />,
      className: 'bg-yellow-500/10 text-yellow-500',
    },
  };

  const { icon, className } = config[recommendation];

  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${className}`}>
      {icon}
      {RECOMMENDATION_MESSAGES[recommendation]}
    </span>
  );
}

/**
 * 델타 지표 아이콘
 */
function DeltaIndicator({ delta }: { delta: number }) {
  if (delta > 2) {
    return <TrendingUp className="h-5 w-5 text-green-500" />;
  }
  if (delta < -2) {
    return <TrendingDown className="h-5 w-5 text-destructive" />;
  }
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

/**
 * 전략별 품질 메트릭 행
 */
function StrategyMetricRow({ metric }: { metric: QualityMetrics }) {
  const { strategy, variant, avgQualityScore, totalChunks, scoreDistribution, autoApprovedRate } = metric;

  const strategyLabel = getStrategyLabel(strategy);
  const variantLabel = variant ? (variant === 'control' ? '대조군' : '처리군') : null;

  // 품질 등급별 색상
  const gradeColors = {
    excellent: 'bg-green-500',
    good: 'bg-blue-500',
    fair: 'bg-yellow-500',
    poor: 'bg-destructive',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{strategyLabel}</span>
          {variantLabel && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {variantLabel}
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-foreground">{avgQualityScore}점</span>
          <p className="text-xs text-muted-foreground">
            {totalChunks}개 청크 · 자동승인 {Math.round(autoApprovedRate * 100)}%
          </p>
        </div>
      </div>

      {/* 품질 분포 바 */}
      <div className="mt-3">
        <div className="flex h-2 overflow-hidden rounded-full">
          {(['excellent', 'good', 'fair', 'poor'] as const).map((grade) => {
            const count = scoreDistribution[grade];
            const percent = totalChunks > 0 ? (count / totalChunks) * 100 : 0;
            if (percent === 0) return null;
            return (
              <div
                key={grade}
                className={gradeColors[grade]}
                style={{ width: `${percent}%` }}
                title={`${QUALITY_GRADE_LABELS[grade]}: ${count}개 (${percent.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {(['excellent', 'good', 'fair', 'poor'] as const).map((grade) => (
            <span key={grade} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${gradeColors[grade]}`} />
              {QUALITY_GRADE_LABELS[grade]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 전략 라벨 변환
 */
function getStrategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    smart: '규칙 기반 (Smart)',
    semantic: 'AI 의미 기반 (Semantic)',
    late: 'Late Chunking',
    unknown: '알 수 없음',
  };
  return labels[strategy] ?? strategy;
}
