'use client';

/**
 * 검색 가능 상태 배지
 * Dense(임베딩) + Sparse(TSV) 기반 검색 가능 여부 표시
 */

interface SearchabilityBadgeProps {
  hasEmbedding: boolean;
  hasContentTsv: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function SearchabilityBadge({
  hasEmbedding,
  hasContentTsv,
  size = 'md',
  showLabel = true,
}: SearchabilityBadgeProps) {
  const isHybrid = hasEmbedding && hasContentTsv;
  const isPartial = hasEmbedding || hasContentTsv;
  const isDenseOnly = hasEmbedding && !hasContentTsv;
  const isSparseOnly = !hasEmbedding && hasContentTsv;

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  if (isHybrid) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses} bg-green-500/10 text-green-500`}
        title="Hybrid 검색 가능 (Dense + Sparse)"
      >
        <span className="font-mono font-bold">H</span>
        {showLabel && <span>Hybrid</span>}
      </span>
    );
  }

  if (isDenseOnly) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses} bg-yellow-500/10 text-yellow-500`}
        title="Dense 검색만 가능 (임베딩)"
      >
        <span className="font-mono font-bold">D</span>
        {showLabel && <span>Dense</span>}
      </span>
    );
  }

  if (isSparseOnly) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses} bg-yellow-500/10 text-yellow-500`}
        title="Sparse 검색만 가능 (TSV)"
      >
        <span className="font-mono font-bold">S</span>
        {showLabel && <span>Sparse</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses} bg-destructive/10 text-destructive`}
      title="검색 불가능"
    >
      <span className="font-mono font-bold">-</span>
      {showLabel && <span>불가</span>}
    </span>
  );
}

/**
 * 검색 가능 통계 표시 컴포넌트
 */
interface SearchabilityStatsProps {
  denseReady: number;
  sparseReady: number;
  hybridReady: number;
  notSearchable: number;
  total: number;
}

export function SearchabilityStats({
  denseReady,
  sparseReady,
  hybridReady,
  notSearchable,
  total,
}: SearchabilityStatsProps) {
  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground">데이터 없음</div>
    );
  }

  const hybridPercent = Math.round((hybridReady / total) * 100);
  const denseOnlyPercent = Math.round(((denseReady - hybridReady) / total) * 100);
  const sparseOnlyPercent = Math.round(((sparseReady - hybridReady) / total) * 100);
  const notSearchablePercent = Math.round((notSearchable / total) * 100);

  return (
    <div className="space-y-2">
      {/* 프로그레스 바 */}
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {hybridPercent > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${hybridPercent}%` }}
            title={`Hybrid: ${hybridReady}개 (${hybridPercent}%)`}
          />
        )}
        {denseOnlyPercent > 0 && (
          <div
            className="bg-yellow-500"
            style={{ width: `${denseOnlyPercent}%` }}
            title={`Dense만: ${denseReady - hybridReady}개 (${denseOnlyPercent}%)`}
          />
        )}
        {sparseOnlyPercent > 0 && (
          <div
            className="bg-orange-500"
            style={{ width: `${sparseOnlyPercent}%` }}
            title={`Sparse만: ${sparseReady - hybridReady}개 (${sparseOnlyPercent}%)`}
          />
        )}
        {notSearchablePercent > 0 && (
          <div
            className="bg-destructive/50"
            style={{ width: `${notSearchablePercent}%` }}
            title={`검색불가: ${notSearchable}개 (${notSearchablePercent}%)`}
          />
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Hybrid</span>
          <span className="font-medium text-foreground">{hybridReady}</span>
        </div>
        {denseReady - hybridReady > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Dense만</span>
            <span className="font-medium text-foreground">{denseReady - hybridReady}</span>
          </div>
        )}
        {sparseReady - hybridReady > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">Sparse만</span>
            <span className="font-medium text-foreground">{sparseReady - hybridReady}</span>
          </div>
        )}
        {notSearchable > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-destructive/50" />
            <span className="text-muted-foreground">검색불가</span>
            <span className="font-medium text-foreground">{notSearchable}</span>
          </div>
        )}
      </div>
    </div>
  );
}
