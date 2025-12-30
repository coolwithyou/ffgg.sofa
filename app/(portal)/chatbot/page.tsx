'use client';

/**
 * 챗봇 테스트 페이지
 * [Week 9] 테넌트가 자신의 챗봇을 테스트
 */

import { useEffect, useState } from 'react';
import { ChatInterface } from './chat-interface';
import { ChatbotSelector } from './chatbot-selector';
import { getTestableChatbots, type TestableChatbot } from './actions';

export default function ChatbotPage() {
  const [chatbots, setChatbots] = useState<TestableChatbot[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<TestableChatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 챗봇 목록 로드
  useEffect(() => {
    async function loadChatbots() {
      setIsLoading(true);
      setError(null);

      const result = await getTestableChatbots();

      if (result.success && result.chatbots) {
        setChatbots(result.chatbots);

        // 기본 챗봇 또는 첫 번째 챗봇 자동 선택
        if (result.chatbots.length > 0) {
          const defaultChatbot =
            result.chatbots.find((c) => c.isDefault) || result.chatbots[0];
          setSelectedChatbot(defaultChatbot);
        }
      } else {
        setError(result.error || '챗봇 목록을 불러오는데 실패했습니다.');
      }

      setIsLoading(false);
    }

    loadChatbots();
  }, []);

  // 챗봇 선택 핸들러
  const handleSelectChatbot = (chatbot: TestableChatbot) => {
    setSelectedChatbot(chatbot);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 페이지 타이틀 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">챗봇 테스트</h1>
        <p className="text-muted-foreground">
          업로드한 문서를 기반으로 챗봇 응답을 테스트하세요.
        </p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* 메인 컨텐츠: 사이드 패널 + 채팅 영역 */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-border">
        {/* 챗봇 선택 사이드 패널 */}
        <ChatbotSelector
          chatbots={chatbots}
          selectedId={selectedChatbot?.id ?? null}
          onSelect={handleSelectChatbot}
          isLoading={isLoading}
        />

        {/* 채팅 인터페이스 */}
        <div className="flex-1 bg-card">
          {selectedChatbot ? (
            <ChatInterface
              key={selectedChatbot.id}
              chatbotId={selectedChatbot.id}
              chatbotName={selectedChatbot.name}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span>챗봇 목록 로딩 중...</span>
                </div>
              ) : (
                <span>테스트할 챗봇을 선택해주세요.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
