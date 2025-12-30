/**
 * 위젯 관리 페이지
 * 외부 웹사이트에 챗봇을 임베드하기 위한 위젯 관리
 */

import { Suspense } from 'react';
import { getChatbotsWithWidgetStatus } from './actions';
import { WidgetList } from './widget-list';
import { Code2 } from 'lucide-react';

export const metadata = {
  title: '위젯 관리 | SOFA',
  description: '외부 웹사이트에 챗봇을 임베드하세요',
};

export default async function WidgetsPage() {
  const chatbots = await getChatbotsWithWidgetStatus();

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">위젯 관리</h1>
          <p className="text-muted-foreground">
            외부 웹사이트에 챗봇을 임베드하세요.
          </p>
        </div>
      </div>

      {/* 안내 카드 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium text-foreground">임베드 위젯 사용법</h3>
            <p className="text-sm text-muted-foreground">
              챗봇을 활성화하면 임베드 코드를 복사하여 외부 웹사이트에 붙여넣기만
              하면 됩니다. 쇼핑몰, 블로그, 랜딩페이지 등 어디서든 사용할 수
              있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 위젯 목록 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <WidgetList chatbots={chatbots} />
      </Suspense>
    </div>
  );
}
