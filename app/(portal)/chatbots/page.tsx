/**
 * 챗봇 관리 페이지
 */

import { Suspense } from 'react';
import { getChatbots } from './actions';
import { ChatbotList } from './chatbot-list';
import { CreateChatbot } from './create-chatbot';

export default async function ChatbotsPage() {
  const chatbots = await getChatbots();

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">챗봇 관리</h1>
          <p className="text-muted-foreground">
            챗봇을 생성하고 데이터셋을 연결하여 배포하세요.
          </p>
        </div>
        <CreateChatbot />
      </div>

      {/* 챗봇 목록 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <ChatbotList chatbots={chatbots} />
      </Suspense>
    </div>
  );
}
