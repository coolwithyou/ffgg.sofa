/**
 * Console 공통 로딩 상태
 * Console 내 페이지 전환 시 표시되는 기본 로딩 UI
 */

export default function ConsoleLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* 스피너 */}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    </div>
  );
}
