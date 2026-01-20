/**
 * 데이터셋 목록 로딩 상태
 * 문서 목록 로딩 시 스켈레톤 UI 표시
 */

export default function DatasetsLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* 페이지 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </div>

      {/* 검색/필터 영역 스켈레톤 */}
      <div className="flex items-center gap-4">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      {/* 문서 목록 스켈레톤 */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            {/* 아이콘 */}
            <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
            {/* 문서 정보 */}
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
            {/* 상태 배지 */}
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            {/* 액션 버튼 */}
            <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
