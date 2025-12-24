/**
 * 챗봇 위젯 페이지
 * [Week 7] iframe 임베드용 페이지
 */

import { Suspense } from 'react';
import { WidgetChat } from './widget-chat';
import { validateWidgetAccess } from './actions';

interface WidgetPageProps {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ key?: string }>;
}

export default async function WidgetPage({ params, searchParams }: WidgetPageProps) {
  const { tenantId } = await params;
  const { key } = await searchParams;

  // API 키 검증
  const validation = await validateWidgetAccess(tenantId, key || '');

  if (!validation.valid) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="rounded-lg bg-white p-6 text-center shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900">접근 불가</h2>
          <p className="mt-2 text-sm text-gray-600">{validation.error}</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <WidgetChat tenantId={tenantId} config={validation.config} />
    </Suspense>
  );
}

// 메타데이터 (X-Frame-Options는 next.config.ts에서 HTTP 헤더로 설정)
export async function generateMetadata() {
  return {
    title: 'Chat Widget',
    robots: 'noindex, nofollow',
  };
}
