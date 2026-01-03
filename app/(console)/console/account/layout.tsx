'use client';

/**
 * Console 계정 설정 레이아웃
 * shadcn/ui Tabs 컴포넌트 적용 (라우팅 연동)
 */

import { usePathname, useRouter } from 'next/navigation';
import { User, Shield, Bell, CreditCard } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Tab {
  value: string;
  href: string;
  label: string;
  icon: typeof User;
}

const tabs: Tab[] = [
  {
    value: 'profile',
    href: '/console/account/profile',
    label: '프로필',
    icon: User,
  },
  {
    value: 'security',
    href: '/console/account/security',
    label: '보안',
    icon: Shield,
  },
  {
    value: 'notifications',
    href: '/console/account/notifications',
    label: '알림',
    icon: Bell,
  },
  {
    value: 'subscription',
    href: '/console/account/subscription',
    label: '구독',
    icon: CreditCard,
  },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // 현재 탭 결정 (서브경로 포함)
  const getCurrentTab = (): string => {
    const tab = tabs.find((t) => pathname.startsWith(t.href));
    return tab?.value || 'profile';
  };

  const handleTabChange = (value: string) => {
    const tab = tabs.find((t) => t.value === value);
    if (tab) {
      router.push(tab.href);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* 페이지 헤더 */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-bold text-foreground">계정 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          계정 정보 및 설정을 관리합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border bg-card px-6">
        <Tabs value={getCurrentTab()} onValueChange={handleTabChange}>
          <TabsList className="h-auto bg-transparent p-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-auto bg-background p-6">{children}</div>
    </div>
  );
}
