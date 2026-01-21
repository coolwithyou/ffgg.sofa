'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * 채팅 테마 설정 타입
 *
 * 채팅 UI 컴포넌트들이 공유하는 스타일 설정
 */
export interface ChatTheme {
  /** 기본 브랜드 색상 (버튼, 사용자 메시지 배경 등) */
  primaryColor: string;
  /** 기본 텍스트 색상 */
  textColor?: string;

  // === 사용자 메시지 스타일 ===
  /** 사용자 메시지 배경색 (미설정 시 primaryColor) */
  userMessageBackgroundColor?: string;
  /** 사용자 메시지 텍스트 색상 (미설정 시 #ffffff) */
  userMessageTextColor?: string;

  // === AI 응답 스타일 ===
  /** AI 응답 배경색 (미설정 시 muted 색상) */
  assistantMessageBackgroundColor?: string;
  /** AI 응답 텍스트 색상 (미설정 시 textColor) */
  assistantMessageTextColor?: string;
}

/**
 * 기본 테마 값
 */
const DEFAULT_CHAT_THEME: ChatTheme = {
  primaryColor: '#3B82F6',
  textColor: '#1F2937',
  userMessageTextColor: '#ffffff',
};

const ChatThemeContext = createContext<ChatTheme | null>(null);

/**
 * ChatThemeProvider Props
 */
interface ChatThemeProviderProps {
  children: ReactNode;
  theme: ChatTheme;
}

/**
 * 채팅 테마 Provider
 *
 * 채팅 UI 컴포넌트 트리 최상단에서 테마를 제공합니다.
 *
 * @example
 * <ChatThemeProvider theme={{ primaryColor: '#3B82F6' }}>
 *   <MessageBubble message={msg} />
 *   <SourcesCollapsible sources={sources} />
 * </ChatThemeProvider>
 */
export function ChatThemeProvider({ children, theme }: ChatThemeProviderProps) {
  // 테마 객체 메모이제이션
  const memoizedTheme = useMemo(
    () => ({ ...DEFAULT_CHAT_THEME, ...theme }),
    [theme]
  );

  return (
    <ChatThemeContext.Provider value={memoizedTheme}>
      {children}
    </ChatThemeContext.Provider>
  );
}

/**
 * 채팅 테마 소비 훅
 *
 * ChatThemeProvider 내부에서만 사용 가능합니다.
 *
 * @throws ChatThemeProvider 외부에서 호출 시 에러
 *
 * @example
 * function MessageBubble({ message }: { message: Message }) {
 *   const theme = useChatTheme();
 *   return (
 *     <div style={{ backgroundColor: theme.userMessageBackgroundColor }}>
 *       {message.content}
 *     </div>
 *   );
 * }
 */
export function useChatTheme(): ChatTheme {
  const context = useContext(ChatThemeContext);
  if (!context) {
    throw new Error('useChatTheme must be used within ChatThemeProvider');
  }
  return context;
}

/**
 * 채팅 테마 소비 훅 (옵셔널)
 *
 * Provider가 없어도 기본값을 반환합니다.
 * 독립적으로 사용될 수 있는 컴포넌트에 유용합니다.
 *
 * @example
 * function StandaloneButton() {
 *   const theme = useChatThemeOptional();
 *   return <button style={{ backgroundColor: theme.primaryColor }}>Send</button>;
 * }
 */
export function useChatThemeOptional(): ChatTheme {
  const context = useContext(ChatThemeContext);
  return context ?? DEFAULT_CHAT_THEME;
}

/**
 * 사용자 메시지 스타일 계산 헬퍼
 */
export function getUserMessageStyle(theme: ChatTheme): React.CSSProperties {
  return {
    backgroundColor: theme.userMessageBackgroundColor || theme.primaryColor,
    color: theme.userMessageTextColor || '#ffffff',
  };
}

/**
 * AI 응답 스타일 계산 헬퍼
 */
export function getAssistantMessageStyle(theme: ChatTheme): React.CSSProperties {
  return {
    ...(theme.assistantMessageBackgroundColor && {
      backgroundColor: theme.assistantMessageBackgroundColor,
    }),
    ...(theme.assistantMessageTextColor && {
      color: theme.assistantMessageTextColor,
    }),
  };
}
