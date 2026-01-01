'use client';

/**
 * 품질 분포 차트
 * 청크 품질 점수의 분포를 가로 막대 차트로 표시
 */

export interface QualityDistribution {
  excellent: number;  // >= 80
  good: number;       // >= 60, < 80
  fair: number;       // >= 40, < 60
  poor: number;       // < 40
  unscored: number;   // null
}

interface QualityDistributionChartProps {
  distribution: QualityDistribution;
  compact?: boolean;
}

const QUALITY_CONFIG = [
  { key: 'excellent', label: '우수', range: '≥80', color: 'bg-green-500', textColor: 'text-green-500' },
  { key: 'good', label: '양호', range: '60-79', color: 'bg-primary', textColor: 'text-primary' },
  { key: 'fair', label: '보통', range: '40-59', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  { key: 'poor', label: '낮음', range: '<40', color: 'bg-destructive', textColor: 'text-destructive' },
  { key: 'unscored', label: '미평가', range: '-', color: 'bg-muted-foreground/50', textColor: 'text-muted-foreground' },
] as const;

export function QualityDistributionChart({
  distribution,
  compact = false,
}: QualityDistributionChartProps) {
  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground">데이터 없음</div>
    );
  }

  const maxCount = Math.max(...Object.values(distribution));

  if (compact) {
    // 컴팩트 모드: 가로 스택 바만 표시
    return (
      <div className="space-y-2">
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {QUALITY_CONFIG.map((config) => {
            const count = distribution[config.key];
            const percent = (count / total) * 100;
            if (percent === 0) return null;

            return (
              <div
                key={config.key}
                className={config.color}
                style={{ width: `${percent}%` }}
                title={`${config.label}: ${count}개 (${Math.round(percent)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {QUALITY_CONFIG.map((config) => {
            const count = distribution[config.key];
            if (count === 0) return null;

            return (
              <div key={config.key} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${config.color}`} />
                <span className="text-muted-foreground">{config.label}</span>
                <span className={`font-medium ${config.textColor}`}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 전체 모드: 가로 막대 차트
  return (
    <div className="space-y-3">
      {QUALITY_CONFIG.map((config) => {
        const count = distribution[config.key];
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

        return (
          <div key={config.key} className="flex items-center gap-3">
            <div className="w-16 text-sm">
              <span className={config.textColor}>{config.label}</span>
              <span className="ml-1 text-xs text-muted-foreground">({config.range})</span>
            </div>
            <div className="flex-1">
              <div className="flex h-5 items-center rounded bg-muted">
                <div
                  className={`h-full rounded ${config.color} transition-all duration-300`}
                  style={{ width: `${barWidth}%`, minWidth: count > 0 ? '4px' : '0' }}
                />
              </div>
            </div>
            <div className="w-20 text-right text-sm">
              <span className="font-medium text-foreground">{count}</span>
              <span className="ml-1 text-muted-foreground">({percent}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 품질 점수 배지
 */
interface QualityScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md';
}

export function QualityScoreBadge({ score, size = 'md' }: QualityScoreBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  if (score === null) {
    return (
      <span className={`rounded font-medium ${sizeClasses} bg-muted text-muted-foreground`}>
        -
      </span>
    );
  }

  let colorClass: string;
  if (score >= 80) {
    colorClass = 'bg-green-500/10 text-green-500';
  } else if (score >= 60) {
    colorClass = 'bg-primary/10 text-primary';
  } else if (score >= 40) {
    colorClass = 'bg-yellow-500/10 text-yellow-500';
  } else {
    colorClass = 'bg-destructive/10 text-destructive';
  }

  return (
    <span className={`rounded font-medium ${sizeClasses} ${colorClass}`}>
      {score}
    </span>
  );
}
