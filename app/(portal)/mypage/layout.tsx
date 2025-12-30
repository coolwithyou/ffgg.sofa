'use client';

/**
 * 마이페이지 레이아웃
 * 탭 네비게이션 포함 (프로필 | 보안 | 구독)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  href: string;
  label: string;
}

const tabs: Tab[] = [
  { href: '/mypage/profile', label: '프로필' },
  { href: '/mypage/security', label: '보안' },
  { href: '/mypage/subscription', label: '구독' },
];

export default function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col">
      {/* 페이지 헤더 */}
      <div className="border-b border-border bg-background px-6 py-4">
        <h1 className="text-2xl font-bold text-foreground">마이페이지</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          계정 정보 및 설정을 관리합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border bg-background">
        <nav className="flex gap-4 px-6" aria-label="마이페이지 탭">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-auto bg-background p-6">{children}</div>
    </div>
  );
}
