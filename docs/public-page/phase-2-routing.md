# Phase 2: 라우팅 및 공개 페이지 렌더링

> 예상 기간: 3-4일

## 목표

`/[slug]` 경로에서 챗봇 공개 페이지 표시

## 선행 조건

- [Phase 1: DB 스키마 및 기반 인프라](./phase-1-db-schema.md) 완료

## 작업 내용

### 2.1 Proxy 수정

**파일**: `proxy.ts`

공개 페이지 URL 패턴을 인증 우회 목록에 추가합니다.

```typescript
// 기존 PUBLIC_PATH_PATTERNS에 추가
const PUBLIC_PATH_PATTERNS = [
  /^\/widget\/[^/]+$/,                          // 기존: /widget/[tenantId]
  /^\/[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/,        // 신규: /[slug] (3-30자)
];

// isPublicPath 함수에서 패턴 매칭 확인
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}
```

#### 주의사항

- 슬러그 패턴이 다른 라우트와 충돌하지 않도록 예약어 시스템과 연계
- 패턴 순서 중요: 더 구체적인 패턴이 먼저 매칭되어야 함

### 2.2 공개 페이지 서버 컴포넌트

**파일**: `app/[slug]/page.tsx` (신규)

```typescript
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { isReservedSlug } from '@/lib/public-page/reserved-slugs';
import { PublicPageView } from './public-page-view';
import { PublicPageConfig } from '@/lib/public-page/types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 슬러그로 활성화된 공개 페이지 챗봇 조회
 */
async function getChatbotBySlug(slug: string) {
  return await db.query.chatbots.findFirst({
    where: and(
      eq(chatbots.slug, slug),
      eq(chatbots.publicPageEnabled, true),
    ),
    with: {
      tenant: true, // 테넌트 정보 (브랜딩 등)
    },
  });
}

/**
 * 동적 메타데이터 생성
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (isReservedSlug(slug)) {
    return { title: 'Not Found' };
  }

  const chatbot = await getChatbotBySlug(slug);

  if (!chatbot) {
    return { title: 'Not Found' };
  }

  const config = chatbot.publicPageConfig as PublicPageConfig;
  const seo = config?.seo || {};

  return {
    title: seo.title || chatbot.name || 'Chat',
    description: seo.description || config?.header?.description,
    openGraph: {
      title: seo.title || chatbot.name,
      description: seo.description,
      images: seo.ogImage ? [seo.ogImage] : [],
    },
  };
}

/**
 * 공개 페이지 서버 컴포넌트
 */
export default async function PublicPage({ params }: PageProps) {
  const { slug } = await params;

  // 예약어 체크 (최우선)
  if (isReservedSlug(slug)) {
    notFound();
  }

  // 챗봇 조회
  const chatbot = await getChatbotBySlug(slug);

  if (!chatbot) {
    notFound();
  }

  return (
    <PublicPageView
      chatbot={{
        id: chatbot.id,
        name: chatbot.name,
        tenantId: chatbot.tenantId,
        config: chatbot.publicPageConfig as PublicPageConfig,
      }}
    />
  );
}

// ISR 캐싱 (5분마다 재검증)
export const revalidate = 300;

// 동적 렌더링 활성화 (슬러그 기반)
export const dynamicParams = true;
```

### 2.3 공개 페이지 클라이언트 뷰

**파일**: `app/[slug]/public-page-view.tsx` (신규)

```typescript
'use client';

import { useState } from 'react';
import { HeaderBlock } from './components/header-block';
import { ChatbotBlock } from './components/chatbot-block';
import { PublicPageConfig } from '@/lib/public-page/types';

interface ChatbotData {
  id: string;
  name: string;
  tenantId: string;
  config: PublicPageConfig;
}

interface PublicPageViewProps {
  chatbot: ChatbotData;
}

export function PublicPageView({ chatbot }: PublicPageViewProps) {
  const { config } = chatbot;
  const theme = config?.theme;

  // 커스텀 테마 CSS 변수 적용
  const customStyles = {
    '--public-bg': theme?.backgroundColor || '#ffffff',
    '--public-primary': theme?.primaryColor || '#3B82F6',
    '--public-text': theme?.textColor || '#1f2937',
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={customStyles}
    >
      <main
        className="flex-1 flex flex-col items-center px-4 py-8"
        style={{ backgroundColor: 'var(--public-bg)' }}
      >
        {/* 최대 너비 컨테이너 */}
        <div className="w-full max-w-lg flex flex-col gap-6">

          {/* 헤더 블록 */}
          <HeaderBlock
            title={config?.header?.title || chatbot.name}
            description={config?.header?.description}
            logoUrl={config?.header?.logoUrl}
            showBrandName={config?.header?.showBrandName}
          />

          {/* 챗봇 블록 */}
          <ChatbotBlock
            chatbotId={chatbot.id}
            tenantId={chatbot.tenantId}
            primaryColor={theme?.primaryColor}
          />

        </div>
      </main>

      {/* 푸터 (Powered by SOFA) */}
      <footer className="py-4 text-center text-sm text-muted-foreground">
        Powered by <a href="/" className="underline hover:text-primary">SOFA</a>
      </footer>
    </div>
  );
}
```

### 2.4 헤더 블록 컴포넌트

**파일**: `app/[slug]/components/header-block.tsx` (신규)

```typescript
'use client';

import Image from 'next/image';

interface HeaderBlockProps {
  title: string;
  description?: string;
  logoUrl?: string;
  showBrandName?: boolean;
}

export function HeaderBlock({
  title,
  description,
  logoUrl,
  showBrandName = true
}: HeaderBlockProps) {
  return (
    <header className="flex flex-col items-center text-center gap-4">
      {/* 로고 */}
      {logoUrl && (
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
          <Image
            src={logoUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
      )}

      {/* 제목 */}
      {showBrandName && title && (
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--public-text)' }}
        >
          {title}
        </h1>
      )}

      {/* 설명 */}
      {description && (
        <p
          className="text-base opacity-80 max-w-md"
          style={{ color: 'var(--public-text)' }}
        >
          {description}
        </p>
      )}
    </header>
  );
}
```

### 2.5 챗봇 블록 컴포넌트

**파일**: `app/[slug]/components/chatbot-block.tsx` (신규)

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { sendPublicPageMessage } from '../actions';

interface ChatbotBlockProps {
  chatbotId: string;
  tenantId: string;
  primaryColor?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatbotBlock({
  chatbotId,
  tenantId,
  primaryColor
}: ChatbotBlockProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 목록 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 서버 액션 호출
      const response = await sendPublicPageMessage(
        chatbotId,
        tenantId,
        trimmedInput,
        sessionId
      );

      // 어시스턴트 응답 추가
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message || '응답을 받지 못했습니다.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
      {/* 메시지 영역 */}
      <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            무엇이든 물어보세요!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'text-white'
                    : 'bg-muted text-foreground'
                }`}
                style={message.role === 'user' ? {
                  backgroundColor: primaryColor || 'var(--public-primary)'
                } : undefined}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {/* 로딩 인디케이터 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-2">
              <span className="flex gap-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-100">●</span>
                <span className="animate-bounce delay-200">●</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-full px-6 py-2 text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: primaryColor || 'var(--public-primary)' }}
          >
            전송
          </button>
        </div>
      </form>
    </div>
  );
}
```

### 2.6 공개 페이지 서버 액션

**파일**: `app/[slug]/actions.ts` (신규)

```typescript
'use server';

import { processChat } from '@/lib/chat/service';

interface ChatResponse {
  message: string;
  sessionId?: string;
}

/**
 * 공개 페이지 채팅 메시지 전송
 *
 * 기존 processChat 서비스를 재활용하되,
 * channel을 'public_page'로 지정하여 추적 가능
 */
export async function sendPublicPageMessage(
  chatbotId: string,
  tenantId: string,
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  try {
    const result = await processChat({
      chatbotId,
      tenantId,
      message,
      sessionId,
      channel: 'public_page', // 공개 페이지 채널 표시
    });

    return {
      message: result.response,
      sessionId: result.sessionId,
    };
  } catch (error) {
    console.error('[PublicPage] Chat error:', error);
    throw new Error('메시지 처리 중 오류가 발생했습니다.');
  }
}
```

### 2.7 404 페이지

**파일**: `app/[slug]/not-found.tsx` (신규)

```typescript
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">페이지를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground mb-8 text-center">
        요청하신 페이지가 존재하지 않거나 비활성화되었습니다.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
```

## 폴더 구조

```
app/
├── [slug]/
│   ├── page.tsx              # 서버 컴포넌트 (데이터 로딩)
│   ├── public-page-view.tsx  # 클라이언트 뷰
│   ├── actions.ts            # 서버 액션 (채팅)
│   ├── not-found.tsx         # 404 페이지
│   └── components/
│       ├── header-block.tsx  # 프로필 헤더
│       └── chatbot-block.tsx # 챗봇 인터페이스
└── ...
```

## 테스트 체크리스트

### 라우팅 테스트

- [ ] 유효한 슬러그 (`/my-bot`) 접근 시 페이지 렌더링
- [ ] 존재하지 않는 슬러그 접근 시 404 표시
- [ ] 예약어 슬러그 (`/admin`, `/api`) 접근 시 404 표시
- [ ] `publicPageEnabled=false`인 챗봇 접근 시 404 표시

### 기능 테스트

- [ ] 헤더 블록 - 제목, 설명, 로고 표시
- [ ] 채팅 메시지 송신 및 응답 수신
- [ ] 채팅 세션 유지 (동일 sessionId)
- [ ] 로딩 상태 표시
- [ ] 에러 발생 시 사용자 친화적 메시지 표시

### 스타일 테스트

- [ ] 커스텀 테마 색상 적용
- [ ] 모바일 반응형 레이아웃
- [ ] 다크모드 호환성

### SEO 테스트

- [ ] 페이지 타이틀 적용
- [ ] meta description 적용
- [ ] Open Graph 태그 생성

### 캐싱 테스트

- [ ] ISR 5분 재검증 동작
- [ ] 설정 변경 후 캐시 갱신

## 롤백 절차

1. `app/[slug]` 폴더 삭제
2. `proxy.ts`에서 슬러그 패턴 제거

```bash
# 롤백 명령
rm -rf app/[slug]
# proxy.ts 수동 편집하여 패턴 제거
```

## 완료 조건

- [ ] `/[slug]` 라우트 동작
- [ ] 헤더 + 챗봇 블록 렌더링
- [ ] 채팅 기능 정상 동작
- [ ] 404 처리 정상 동작
- [ ] 기존 widget 경로 영향 없음

## 다음 단계

Phase 2 완료 후 → [Phase 3: 포탈 관리 UI](./phase-3-portal-ui.md)
