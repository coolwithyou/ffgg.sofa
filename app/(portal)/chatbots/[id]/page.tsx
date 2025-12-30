/**
 * 챗봇 상세 페이지
 */

import { Suspense } from 'react';
import { ChatbotDetail } from './chatbot-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatbotDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <ChatbotDetail chatbotId={id} />
      </Suspense>
    </div>
  );
}
