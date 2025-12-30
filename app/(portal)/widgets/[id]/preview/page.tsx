/**
 * 위젯 미리보기 페이지
 * 실제 외부 사이트에 임베드했을 때의 모습을 미리 확인
 */

import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { WidgetPreview } from './widget-preview';

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: '위젯 미리보기 | SOFA',
  description: '위젯이 실제로 어떻게 보이는지 미리 확인하세요',
};

export default async function WidgetPreviewPage({ params }: PreviewPageProps) {
  const session = await validateSession();
  if (!session) {
    notFound();
  }

  const { id } = await params;
  const tenantId = session.tenantId;

  // 챗봇 조회
  const [chatbot] = await db
    .select({
      id: chatbots.id,
      name: chatbots.name,
      widgetEnabled: chatbots.widgetEnabled,
      widgetApiKey: chatbots.widgetApiKey,
      widgetConfig: chatbots.widgetConfig,
    })
    .from(chatbots)
    .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

  if (!chatbot) {
    notFound();
  }

  return (
    <WidgetPreview
      chatbot={{
        id: chatbot.id,
        name: chatbot.name,
        widgetEnabled: chatbot.widgetEnabled ?? false,
        widgetApiKey: chatbot.widgetApiKey,
        widgetConfig: (chatbot.widgetConfig as Record<string, unknown>) || {},
      }}
    />
  );
}
