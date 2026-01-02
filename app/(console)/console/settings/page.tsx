'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Globe, Trash2 } from 'lucide-react';

/**
 * Settings - 일반 설정 페이지
 *
 * 챗봇의 기본 설정을 관리하는 페이지
 */
export default function SettingsPage() {
  const { currentChatbot } = useCurrentChatbot();

  return (
    <div className="p-6">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          일반 설정
        </h1>
        <p className="mt-1 text-muted-foreground">
          챗봇의 기본 정보와 설정을 관리합니다
        </p>
      </div>

      <div className="space-y-6">
        {/* 기본 정보 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <CardTitle>기본 정보</CardTitle>
            </div>
            <CardDescription>
              챗봇의 이름과 설명을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                챗봇 이름
              </label>
              <input
                type="text"
                defaultValue={currentChatbot?.name ?? ''}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                설명
              </label>
              <textarea
                rows={3}
                placeholder="챗봇에 대한 간단한 설명을 입력하세요"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* 공개 설정 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>공개 설정</CardTitle>
            </div>
            <CardDescription>
              챗봇 페이지의 공개 여부를 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">공개 페이지</p>
                <p className="text-sm text-muted-foreground">
                  누구나 접속할 수 있는 공개 페이지를 활성화합니다
                </p>
              </div>
              <Button variant="outline" size="sm">
                {currentChatbot?.publicPageEnabled ? '비활성화' : '활성화'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 위험 영역 카드 */}
        <Card size="md" variant="ghost" className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">위험 영역</CardTitle>
            </div>
            <CardDescription>
              이 작업은 되돌릴 수 없습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">챗봇 삭제</p>
                <p className="text-sm text-muted-foreground">
                  모든 데이터와 설정이 영구적으로 삭제됩니다
                </p>
              </div>
              <Button variant="destructive" size="sm">
                삭제
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
