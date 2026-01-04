'use client';

/**
 * 위젯 채팅 컴포넌트
 * [Week 7] 플로팅 채팅창 UI
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendWidgetMessage, type WidgetChatError } from './actions';
import type { WidgetConfig, WidgetMessage } from '@/lib/widget/types';

/**
 * 위젯 채팅 에러 파싱
 */
interface ParsedError {
  message: string;
  code?: 'INSUFFICIENT_POINTS' | 'RATE_LIMIT' | 'VALIDATION_ERROR';
}

function parseError(error: unknown): ParsedError {
  if (!(error instanceof Error)) {
    return { message: '메시지 전송에 실패했습니다.' };
  }

  try {
    const parsed = JSON.parse(error.message) as WidgetChatError;
    return {
      message: parsed.details?.message || parsed.error,
      code: parsed.code,
    };
  } catch {
    return { message: error.message };
  }
}

/**
 * 위젯 상태 (에러 구조화)
 */
interface WidgetChatState {
  isOpen: boolean;
  isLoading: boolean;
  messages: WidgetMessage[];
  sessionId: string | null;
  error: ParsedError | null;
}

interface WidgetChatProps {
  tenantId: string;
  chatbotId?: string;
  config?: Partial<WidgetConfig>;
}

const DEFAULT_THEME_VALUES = {
  primaryColor: '#3B82F6',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: 16,
  buttonSize: 56,
};

// 메시지 최대 길이 제한
const MAX_MESSAGE_LENGTH = 4000;

export function WidgetChat({ tenantId, chatbotId, config }: WidgetChatProps) {
  const [state, setState] = useState<WidgetChatState>({
    isOpen: true, // iframe에서는 항상 열림
    isLoading: false,
    messages: [],
    sessionId: null,
    error: null,
  });

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const theme = { ...DEFAULT_THEME_VALUES, ...config?.theme };
  const title = config?.title || '도움이 필요하신가요?';
  const subtitle = config?.subtitle || '무엇이든 물어보세요';
  const placeholder = config?.placeholder || '메시지를 입력하세요...';
  const welcomeMessage = config?.welcomeMessage || '안녕하세요! 무엇을 도와드릴까요?';

  // 초기 웰컴 메시지
  useEffect(() => {
    if (state.messages.length === 0 && welcomeMessage) {
      setState((prev) => ({
        ...prev,
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            content: welcomeMessage,
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    }
  }, [welcomeMessage, state.messages.length]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // 메시지 전송
  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || state.isLoading || message.length > MAX_MESSAGE_LENGTH) return;

    setInputValue('');
    const userMessage: WidgetMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      messages: [...prev.messages, userMessage],
    }));

    try {
      const response = await sendWidgetMessage(tenantId, message, state.sessionId || undefined, chatbotId);

      const assistantMessage: WidgetMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      setState((prev) => ({
        ...prev,
        isLoading: false,
        sessionId: response.sessionId,
        messages: [...prev.messages, assistantMessage],
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: parseError(error),
      }));
    }
  }, [inputValue, state.isLoading, state.sessionId, tenantId]);

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex h-screen flex-col"
      style={{
        fontFamily: theme.fontFamily,
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
      }}
    >
      {/* 헤더 */}
      <header
        className="flex-shrink-0 px-4 py-3"
        style={{ backgroundColor: theme.primaryColor }}
      >
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
      </header>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {state.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              primaryColor={theme.primaryColor}
            />
          ))}
          {state.isLoading && <TypingIndicator primaryColor={theme.primaryColor} />}
          {state.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {state.error.message}
              {state.error.code === 'INSUFFICIENT_POINTS' && (
                <p className="mt-1 text-xs opacity-80">
                  서비스 이용이 일시적으로 제한되었습니다.
                </p>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="flex-shrink-0 border-t p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={state.isLoading}
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={state.isLoading || !inputValue.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-50"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <SendIcon className="h-5 w-5 text-white" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          Powered by SOFA
        </p>
      </div>
    </div>
  );
}

// 메시지 버블 컴포넌트
function MessageBubble({
  message,
  primaryColor,
}: {
  message: WidgetMessage;
  primaryColor: string;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser ? 'text-white' : 'bg-gray-100 text-gray-900'
        }`}
        style={isUser ? { backgroundColor: primaryColor } : undefined}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 border-t border-gray-200 pt-2">
            <p className="text-xs text-gray-500">
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
      <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3">
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
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
