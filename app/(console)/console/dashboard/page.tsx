'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
} from 'lucide-react';

/**
 * Dashboard 페이지
 *
 * 챗봇 개요 및 최근 활동 통계 표시
 */
export default function DashboardPage() {
  const { currentChatbot } = useCurrentChatbot();

  const stats = [
    {
      label: '총 대화 수',
      value: '1,234',
      change: '+12%',
      icon: MessageSquare,
    },
    {
      label: '활성 사용자',
      value: '567',
      change: '+8%',
      icon: Users,
    },
    {
      label: '응답률',
      value: '94.5%',
      change: '+2.3%',
      icon: TrendingUp,
    },
    {
      label: '평균 응답 시간',
      value: '1.2초',
      change: '-0.3초',
      icon: Clock,
    },
  ];

  return (
    <div className="p-6">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          대시보드
        </h1>
        <p className="mt-1 text-muted-foreground">
          {currentChatbot?.name ?? '챗봇'}의 전체 현황을 확인하세요
        </p>
      </div>

      {/* 통계 카드 그리드 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} size="md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-green-500">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 최근 활동 섹션 (플레이스홀더) */}
      <div className="mt-8">
        <Card size="md">
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
            <CardDescription>
              지난 7일간의 챗봇 활동 내역입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              차트 영역 (추후 구현)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
