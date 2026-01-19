'use client';

/**
 * 공개 페이지 챗봇 블록
 *
 * 채팅 인터페이스 컴포넌트
 * - 메시지 목록 (사용자/어시스턴트)
 * - 입력창
 * - 로딩 인디케이터
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStickToBottom } from 'use-stick-to-bottom';
import { ChevronDown } from 'lucide-react';
import {
  sendPublicPageMessage,
  type PublicPageChatResponse,
  type PublicPageChatError,
} from '../actions';
import { ProgressIndicator } from '@/components/chat/progress-indicator';
import { SourcesCollapsible, type Source } from '@/components/chat/sources-collapsible';
import { MessageActions } from '@/components/chat/message-actions';
import { ErrorMessage, type ChatError } from '@/components/chat/error-message';

interface ChatbotBlockProps {
  chatbotId: string;
  tenantId: string;
  welcomeMessage: string;
  placeholder: string;
  primaryColor: string;
  textColor: string;
  /** 채팅 영역 최소 높이 (px) */
  minHeight?: number;
  /** 채팅 영역 최대 높이 (px) */
  maxHeight?: number;
  /** 편집 모드 여부 (편집 모드에서는 자동 스크롤 비활성화) */
  isEditing?: boolean;

  // === 컨테이너 스타일 (미설정 시 테마 색상 사용) ===
  /** 테두리 색상 */
  borderColor?: string;
  /** 배경 색상 */
  backgroundColor?: string;

  // === 입력 필드 스타일 ===
  /** 입력 필드 배경색 */
  inputBackgroundColor?: string;
  /** 입력 필드 텍스트 색상 */
  inputTextColor?: string;

  // === 전송 버튼 스타일 ===
  /** 버튼 배경색 (미설정 시 primaryColor) */
  buttonBackgroundColor?: string;
  /** 버튼 텍스트 색상 (미설정 시 #ffffff) */
  buttonTextColor?: string;

  // === 사용자 메시지 버블 ===
  /** 사용자 메시지 배경색 (미설정 시 primaryColor) */
  userMessageBackgroundColor?: string;
  /** 사용자 메시지 텍스트 색상 (미설정 시 #ffffff) */
  userMessageTextColor?: string;

  // === AI 응답 버블 ===
  /** AI 응답 배경색 (미설정 시 muted 색상) */
  assistantMessageBackgroundColor?: string;
  /** AI 응답 텍스트 색상 (미설정 시 textColor) */
  assistantMessageTextColor?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

// 메시지 최대 길이
const MAX_MESSAGE_LENGTH = 4000;

/**
 * 에러 메시지 파싱
 * JSON 형식의 에러 메시지를 파싱하여 구조화된 에러 정보를 반환
 */
function parseError(error: unknown): ChatError {
  if (!(error instanceof Error)) {
    return { message: '메시지 전송에 실패했습니다.' };
  }

  try {
    const parsed = JSON.parse(error.message) as PublicPageChatError;
    return {
      message: parsed.details?.message || parsed.error,
      code: parsed.code,
    };
  } catch {
    // JSON 파싱 실패 시 원본 메시지 사용
    return { message: error.message };
  }
}

export function ChatbotBlock({
  chatbotId,
  tenantId,
  welcomeMessage,
  placeholder,
  primaryColor,
  textColor,
  minHeight = 400,
  maxHeight = 600,
  isEditing = false,
  // 컨테이너 스타일
  borderColor,
  backgroundColor,
  // 입력 필드 스타일
  inputBackgroundColor,
  inputTextColor,
  // 버튼 스타일
  buttonBackgroundColor,
  buttonTextColor,
  // 메시지 스타일
  userMessageBackgroundColor,
  userMessageTextColor,
  assistantMessageBackgroundColor,
  assistantMessageTextColor,
}: ChatbotBlockProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // 스마트 오토스크롤: 사용자가 위로 스크롤하면 자동 스크롤 비활성화
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();

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

  // 메시지 전송 (내부 함수 - 실제 API 호출)
  const sendMessage = useCallback(
    async (message: string, addUserMessage = true) => {
      if (addUserMessage) {
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      setLastUserMessage(message);
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
        setError(null);
        setLastUserMessage(null);
      } catch (err) {
        setError(parseError(err));
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, chatbotId, tenantId]
  );

  // 메시지 전송 (사용자 입력)
  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading || message.length > MAX_MESSAGE_LENGTH) return;

    setInputValue('');
    setError(null);
    await sendMessage(message);
  }, [inputValue, isLoading, sendMessage]);

  // 재시도
  const handleRetry = useCallback(async () => {
    if (!lastUserMessage || isRetrying) return;

    setIsRetrying(true);
    setError(null);

    try {
      await sendMessage(lastUserMessage, false);
    } finally {
      setIsRetrying(false);
    }
  }, [lastUserMessage, isRetrying, sendMessage]);

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isInputValid = inputValue.trim().length > 0 && inputValue.length <= MAX_MESSAGE_LENGTH;

  // 컨테이너 스타일 계산
  const containerStyle: React.CSSProperties = {
    minHeight,
    maxHeight,
    ...(backgroundColor && { backgroundColor }),
    ...(borderColor && { borderColor }),
  };

  // 입력 필드 스타일 계산
  const inputStyle: React.CSSProperties = {
    ...(inputBackgroundColor && { backgroundColor: inputBackgroundColor }),
    ...(inputTextColor && { color: inputTextColor }),
  };

  // 버튼 스타일 계산
  const buttonStyle: React.CSSProperties = {
    backgroundColor: buttonBackgroundColor || primaryColor,
    color: buttonTextColor || '#ffffff',
  };

  return (
    <div
      className="flex flex-col rounded-2xl border border-border bg-card shadow-lg"
      style={containerStyle}
    >
      {/* 메시지 목록 */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto p-4">
        <div ref={contentRef} className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              primaryColor={primaryColor}
              userMessageBackgroundColor={userMessageBackgroundColor}
              userMessageTextColor={userMessageTextColor}
              assistantMessageBackgroundColor={assistantMessageBackgroundColor}
              assistantMessageTextColor={assistantMessageTextColor}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className="max-w-[85%] rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: assistantMessageBackgroundColor || undefined,
                }}
              >
                <ProgressIndicator isLoading={isLoading} primaryColor={primaryColor} compact />
              </div>
            </div>
          )}
          {error && (
            <ErrorMessage
              error={error}
              onRetry={handleRetry}
              isRetrying={isRetrying}
              primaryColor={primaryColor}
              compact
            />
          )}
        </div>

        {/* 스크롤 투 바텀 버튼: 사용자가 위로 스크롤했을 때만 표시 (편집 모드 제외) */}
        {!isAtBottom && !isEditing && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
            style={{ backgroundColor: primaryColor }}
            aria-label="최신 메시지로 이동"
          >
            <ChevronDown className="h-5 w-5 text-white" />
          </button>
        )}
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
            style={inputStyle}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !isInputValid}
            className="flex h-12 w-12 items-center justify-center rounded-full transition-opacity disabled:opacity-50"
            style={buttonStyle}
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
  userMessageBackgroundColor,
  userMessageTextColor,
  assistantMessageBackgroundColor,
  assistantMessageTextColor,
}: {
  message: Message;
  primaryColor: string;
  userMessageBackgroundColor?: string;
  userMessageTextColor?: string;
  assistantMessageBackgroundColor?: string;
  assistantMessageTextColor?: string;
}) {
  const isUser = message.role === 'user';

  // 사용자 메시지 스타일 계산
  const userStyle: React.CSSProperties = {
    backgroundColor: userMessageBackgroundColor || primaryColor,
    color: userMessageTextColor || '#ffffff',
  };

  // AI 응답 스타일 계산
  const assistantStyle: React.CSSProperties = {
    ...(assistantMessageBackgroundColor && { backgroundColor: assistantMessageBackgroundColor }),
    ...(assistantMessageTextColor && { color: assistantMessageTextColor }),
  };

  return (
    <div
      className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}
      data-role={message.role}
    >
      <div className={`flex max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${isUser ? '' : 'bg-muted text-foreground'}`}
          style={isUser ? userStyle : assistantStyle}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
          {message.sources && message.sources.length > 0 && (
            <SourcesCollapsible
              sources={message.sources}
              primaryColor={primaryColor}
              compact
            />
          )}
        </div>

        {/* AI 응답에만 액션 버튼 표시 */}
        {!isUser && message.id !== 'welcome' && (
          <div className="mt-1 px-1">
            <MessageActions
              messageId={message.id}
              content={message.content}
              compact
              primaryColor={primaryColor}
            />
          </div>
        )}
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
