'use client';

/**
 * 공개 페이지 챗봇 블록
 *
 * 채팅 인터페이스 컴포넌트
 * - 메시지 목록 (사용자/어시스턴트)
 * - 입력창
 * - 로딩 인디케이터
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendPublicPageMessage, type PublicPageChatResponse } from '../actions';

interface ChatbotBlockProps {
  chatbotId: string;
  tenantId: string;
  welcomeMessage: string;
  placeholder: string;
  primaryColor: string;
  textColor: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Array<{ title: string; content?: string }>;
}

// 메시지 최대 길이
const MAX_MESSAGE_LENGTH = 4000;

export function ChatbotBlock({
  chatbotId,
  tenantId,
  welcomeMessage,
  placeholder,
  primaryColor,
}: ChatbotBlockProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 초기 웰컴 메시지
  useEffect(() => {
    if (messages.length === 0 && welcomeMessage) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [welcomeMessage, messages.length]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 전송
  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading || message.length > MAX_MESSAGE_LENGTH) return;

    setInputValue('');
    setError(null);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response: PublicPageChatResponse = await sendPublicPageMessage(
        chatbotId,
        tenantId,
        message,
        sessionId || undefined
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSessionId(response.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '메시지 전송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, sessionId, chatbotId, tenantId]);

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isInputValid = inputValue.trim().length > 0 && inputValue.length <= MAX_MESSAGE_LENGTH;

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card shadow-lg">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '60vh', minHeight: '300px' }}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} primaryColor={primaryColor} />
          ))}
          {isLoading && <TypingIndicator primaryColor={primaryColor} />}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            maxLength={MAX_MESSAGE_LENGTH}
            className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !isInputValid}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
            aria-label="전송"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
        {inputValue.length > MAX_MESSAGE_LENGTH * 0.9 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {inputValue.length} / {MAX_MESSAGE_LENGTH}자
          </p>
        )}
      </div>
    </div>
  );
}

// 메시지 버블 컴포넌트
function MessageBubble({
  message,
  primaryColor,
}: {
  message: Message;
  primaryColor: string;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} data-role={message.role}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser ? 'text-white' : 'bg-muted text-foreground'
        }`}
        style={isUser ? { backgroundColor: primaryColor } : undefined}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 border-t border-border/50 pt-2">
            <p className="text-xs opacity-70">
              {message.sources.length}개의 출처에서 참조됨
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 타이핑 인디케이터
function TypingIndicator({ primaryColor }: { primaryColor: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        <div
          className="h-2 w-2 animate-bounce rounded-full"
          style={{ backgroundColor: primaryColor, animationDelay: '0ms' }}
        />
        <div
          className="h-2 w-2 animate-bounce rounded-full"
          style={{ backgroundColor: primaryColor, animationDelay: '150ms' }}
        />
        <div
          className="h-2 w-2 animate-bounce rounded-full"
          style={{ backgroundColor: primaryColor, animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}

// 전송 아이콘
function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
