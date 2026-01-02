/**
 * 공개 페이지 404 페이지
 *
 * 다음 경우에 표시됩니다:
 * - 존재하지 않는 슬러그
 * - 예약어 슬러그 (admin, api 등)
 * - publicPageEnabled가 false인 챗봇
 * - 비활성 테넌트의 챗봇
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        {/* 404 아이콘 */}
        <div className="mb-6 text-6xl font-bold text-muted-foreground">404</div>

        {/* 메시지 */}
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mb-8 text-muted-foreground">
          요청하신 페이지가 존재하지 않거나 비활성화되었습니다.
        </p>

        {/* 홈으로 이동 버튼 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <HomeIcon className="h-5 w-5" />
          <span>홈으로 이동</span>
        </Link>
      </div>
    </main>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}
