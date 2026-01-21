'use client';

/**
 * 위젯 채팅 컴포넌트
 * [Week 7] 플로팅 채팅창 UI
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStickToBottom } from 'use-stick-to-bottom';
import { ChevronDown } from 'lucide-react';
import { sendWidgetMessage, type WidgetChatError } from './actions';
import type { WidgetConfig, WidgetMessage } from '@/lib/widget/types';
import { MessageActions } from '@/components/chat/message-actions';
import { ErrorMessage, type ChatError } from '@/components/chat/error-message';
import { SendIcon } from '@/components/chat/icons';
import {
  ChatThemeProvider,
  useChatTheme,
  getUserMessageStyle,
  type ChatTheme,
} from '@/components/chat/chat-theme-context';

/**
 * 위젯 채팅 에러 파싱
 */
function parseError(error: unknown): ChatError {
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
  error: ChatError | null;
  /** 마지막 사용자 메시지 (재시도용) */
  lastUserMessage: string | null;
  /** 재시도 중 여부 */
  isRetrying: boolean;
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
    lastUserMessage: null,
    isRetrying: false,
  });

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 스마트 오토스크롤: 사용자가 위로 스크롤하면 자동 스크롤 비활성화
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();

  // 위젯 테마 객체 메모이제이션 (config.theme이 변경될 때만 재생성)
  const widgetTheme = useMemo(
    () => ({ ...DEFAULT_THEME_VALUES, ...config?.theme }),
    [config?.theme]
  );

  // 채팅 버블용 ChatTheme 객체 (ChatThemeContext용)
  const chatTheme = useMemo<ChatTheme>(
    () => ({
      primaryColor: widgetTheme.primaryColor,
      textColor: widgetTheme.textColor,
      // 위젯은 기본 스타일 사용 (primaryColor, 흰색 텍스트)
    }),
    [widgetTheme.primaryColor, widgetTheme.textColor]
  );

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

  // 메시지 전송 (내부 함수 - 실제 API 호출)
  const sendMessage = useCallback(
    async (message: string, addUserMessage = true) => {
      if (addUserMessage) {
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
          lastUserMessage: message,
          messages: [...prev.messages, userMessage],
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
          lastUserMessage: message,
        }));
      }

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
          error: null,
          lastUserMessage: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: parseError(error),
        }));
      }
    },
    [state.sessionId, tenantId, chatbotId]
  );

  // 메시지 전송 (사용자 입력)
  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || state.isLoading || message.length > MAX_MESSAGE_LENGTH) return;

    setInputValue('');
    await sendMessage(message);
  }, [inputValue, state.isLoading, sendMessage]);

  // 재시도
  const handleRetry = useCallback(async () => {
    if (!state.lastUserMessage || state.isRetrying) return;

    setState((prev) => ({ ...prev, isRetrying: true, error: null }));

    try {
      await sendMessage(state.lastUserMessage, false);
    } finally {
      setState((prev) => ({ ...prev, isRetrying: false }));
    }
  }, [state.lastUserMessage, state.isRetrying, sendMessage]);

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
        fontFamily: widgetTheme.fontFamily,
        backgroundColor: widgetTheme.backgroundColor,
        color: widgetTheme.textColor,
      }}
    >
      {/* 헤더 */}
      <header
        className="flex-shrink-0 px-4 py-3"
        style={{ backgroundColor: widgetTheme.primaryColor }}
      >
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
      </header>

      {/* 메시지 목록 - ChatThemeProvider로 래핑하여 MessageBubble이 Context 사용 */}
      <ChatThemeProvider theme={chatTheme}>
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto p-4">
          <div ref={contentRef} className="space-y-4">
            {state.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {state.isLoading && <TypingIndicator primaryColor={widgetTheme.primaryColor} />}
            {state.error && (
              <ErrorMessage
                error={state.error}
                onRetry={handleRetry}
                isRetrying={state.isRetrying}
                primaryColor={widgetTheme.primaryColor}
                compact
              />
            )}
          </div>

          {/* 스크롤 투 바텀 버튼: 사용자가 위로 스크롤했을 때만 표시 */}
          {!isAtBottom && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
              style={{ backgroundColor: widgetTheme.primaryColor }}
              aria-label="최신 메시지로 이동"
            >
              <ChevronDown className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
      </ChatThemeProvider>

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
            style={{ backgroundColor: widgetTheme.primaryColor }}
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

// 메시지 버블 컴포넌트 - ChatThemeContext에서 테마를 가져옴
function MessageBubble({ message }: { message: WidgetMessage }) {
  const theme = useChatTheme();
  const isUser = message.role === 'user';

  // 헬퍼 함수로 사용자 메시지 스타일 계산
  const userStyle = getUserMessageStyle(theme);

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser ? '' : 'bg-gray-100 text-gray-900'
          }`}
          style={isUser ? userStyle : undefined}
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

        {/* AI 응답에만 액션 버튼 표시 */}
        {!isUser && message.id !== 'welcome' && (
          <div className="mt-1 px-1">
            <MessageActions
              messageId={message.id}
              content={message.content}
              compact
              primaryColor={theme.primaryColor}
            />
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

