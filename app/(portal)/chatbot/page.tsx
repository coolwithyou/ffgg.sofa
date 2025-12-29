/**
 * 챗봇 테스트 페이지
 * [Week 9] 테넌트가 자신의 챗봇을 테스트
 */

import { ChatInterface } from './chat-interface';

export default function ChatbotPage() {
  return (
    <div className="flex h-full flex-col">
      {/* 페이지 타이틀 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">챗봇 테스트</h1>
        <p className="text-muted-foreground">
          업로드한 문서를 기반으로 챗봇 응답을 테스트하세요.
        </p>
      </div>

      {/* 채팅 인터페이스 */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <ChatInterface />
      </div>
    </div>
  );
}
