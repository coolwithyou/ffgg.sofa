'use client';

/**
 * 품질 점수 표시 컴포넌트
 * 청크의 품질 점수를 시각적으로 표현
 */

interface QualityIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function QualityIndicator({
  score,
  size = 'md',
  showLabel = true,
}: QualityIndicatorProps) {
  const { colorClass, bgClass, label } = getScoreConfig(score);

  const sizeClasses = {
    sm: 'h-1.5 w-16',
    md: 'h-2 w-20',
    lg: 'h-2.5 w-24',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`overflow-hidden rounded-full bg-muted ${sizeClasses[size]}`}>
        <div
          className={`h-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      {showLabel && (
        <span className={`font-medium ${textSizes[size]} ${bgClass}`}>
          {Math.round(score)}점
          {size !== 'sm' && <span className="ml-1 text-muted-foreground">({label})</span>}
        </span>
      )}
    </div>
  );
}

/**
 * 품질 배지 컴포넌트
 * 컴팩트한 배지 형태의 품질 점수 표시
 */
interface QualityBadgeProps {
  score: number;
  autoApproved?: boolean;
}

export function QualityBadge({ score, autoApproved }: QualityBadgeProps) {
  const { bgClass, textClass, label } = getScoreConfig(score);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bgClass} ${textClass}`}
      >
        {Math.round(score)}점
      </span>
      {autoApproved && (
        <span className="inline-flex items-center gap-0.5 text-xs text-green-500">
          <CheckIcon />
          자동승인
        </span>
      )}
    </div>
  );
}

/**
 * 품질 요약 카드 컴포넌트
 */
interface QualitySummaryProps {
  totalChunks: number;
  avgScore: number;
  autoApprovedCount: number;
  pendingCount: number;
}

export function QualitySummary({
  totalChunks,
  avgScore,
  autoApprovedCount,
  pendingCount,
}: QualitySummaryProps) {
  const autoApprovalRate = totalChunks > 0 ? (autoApprovedCount / totalChunks) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <SummaryCard
        label="총 청크"
        value={totalChunks}
        unit="개"
      />
      <SummaryCard
        label="평균 품질"
        value={avgScore.toFixed(1)}
        unit="점"
        colorClass={getScoreConfig(avgScore).textClass}
      />
      <SummaryCard
        label="자동 승인"
        value={autoApprovedCount}
        unit="개"
        subtext={`${autoApprovalRate.toFixed(0)}%`}
        colorClass="text-green-500"
      />
      <SummaryCard
        label="검토 필요"
        value={pendingCount}
        unit="개"
        colorClass={pendingCount > 0 ? 'text-yellow-500' : 'text-muted-foreground'}
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number | string;
  unit: string;
  subtext?: string;
  colorClass?: string;
}

function SummaryCard({ label, value, unit, subtext, colorClass }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${colorClass || 'text-foreground'}`}>
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
        {subtext && (
          <span className="ml-2 text-sm text-muted-foreground">({subtext})</span>
        )}
      </div>
    </div>
  );
}

// 점수별 설정 헬퍼
function getScoreConfig(score: number) {
  if (score >= 85) {
    return {
      colorClass: 'bg-green-500',
      bgClass: 'bg-green-500/10',
      textClass: 'text-green-500',
      label: '우수',
    };
  }
  if (score >= 70) {
    return {
      colorClass: 'bg-yellow-500',
      bgClass: 'bg-yellow-500/10',
      textClass: 'text-yellow-500',
      label: '보통',
    };
  }
  if (score >= 50) {
    return {
      colorClass: 'bg-orange-500',
      bgClass: 'bg-orange-500/10',
      textClass: 'text-orange-500',
      label: '개선 필요',
    };
  }
  return {
    colorClass: 'bg-destructive',
    bgClass: 'bg-destructive/10',
    textClass: 'text-destructive',
    label: '낮음',
  };
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
