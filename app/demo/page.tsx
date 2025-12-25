'use client';

/**
 * 데모 페이지
 * 로그인 없이 RAG 챗봇을 체험할 수 있는 페이지
 */

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// 데모용 샘플 응답
const DEMO_RESPONSES: Record<string, string> = {
  default: `안녕하세요! SOFA 데모 챗봇입니다.

이것은 RAG(Retrieval-Augmented Generation) 기반 AI 챗봇의 데모입니다.
실제 서비스에서는 업로드하신 문서를 기반으로 정확한 답변을 제공합니다.

**SOFA의 주요 기능:**
- 📄 다양한 문서 형식 지원 (PDF, DOC, TXT 등)
- 🔍 정확한 문서 기반 답변
- 💬 카카오톡 연동 지원
- 📊 대화 분석 및 인사이트

무엇이 궁금하신가요?`,

  기능: `SOFA는 다음과 같은 기능을 제공합니다:

**1. 문서 관리**
- PDF, Word, 텍스트 파일 등 다양한 형식 지원
- 자동 청킹 및 벡터 임베딩
- 품질 검토 및 승인 워크플로우

**2. AI 챗봇**
- 문서 기반 정확한 답변 생성
- 컨텍스트 인식 대화
- 다국어 지원

**3. 연동**
- 웹 위젯 임베딩
- 카카오톡 채널 연동
- REST API 제공

**4. 분석**
- 대화 로그 분석
- 자주 묻는 질문 파악
- 응답 품질 모니터링`,

  가격: `SOFA는 다양한 요금제를 제공합니다:

**Starter (무료 체험)**
- 월 1,000건 대화
- 10개 문서 업로드
- 웹 위젯 지원

**Pro**
- 월 10,000건 대화
- 100개 문서 업로드
- 카카오톡 연동
- 우선 지원

**Enterprise**
- 무제한 대화
- 무제한 문서
- 전담 지원
- 커스텀 연동

자세한 내용은 영업팀에 문의해 주세요!`,

  연동: `SOFA는 다양한 플랫폼과 연동됩니다:

**웹사이트**
\`\`\`html
<script src="https://cdn.sofa.ai/widget.js"></script>
<script>
  SOFA.init({ tenantId: 'your-id' });
</script>
\`\`\`

**카카오톡**
1. 카카오 비즈니스 채널 생성
2. SOFA 대시보드에서 연동 설정
3. 스킬 URL 등록

**REST API**
\`\`\`bash
curl -X POST https://api.sofa.ai/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"message": "안녕하세요"}'
\`\`\``,
};

function findBestResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('기능') || lowerQuery.includes('할 수 있')) {
    return DEMO_RESPONSES['기능'];
  }
  if (lowerQuery.includes('가격') || lowerQuery.includes('요금') || lowerQuery.includes('비용')) {
    return DEMO_RESPONSES['가격'];
  }
  if (lowerQuery.includes('연동') || lowerQuery.includes('카카오') || lowerQuery.includes('api')) {
    return DEMO_RESPONSES['연동'];
  }

  return DEMO_RESPONSES['default'];
}

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 초기 인사 메시지
    const initialMessage: Message = {
      id: '1',
      role: 'assistant',
      content:
        '안녕하세요! SOFA 데모에 오신 것을 환영합니다. 🎉\n\n저는 문서 기반으로 답변하는 AI 챗봇입니다. 아래 예시 질문을 클릭하거나 직접 질문해 보세요!',
      timestamp: new Date(),
    };
    setMessages([initialMessage]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // 타이핑 효과를 위한 지연
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

    // AI 응답 추가
    const response = findBestResponse(messageText);
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const sampleQuestions = [
    'SOFA는 어떤 기능이 있나요?',
    '가격은 어떻게 되나요?',
    '카카오톡 연동은 어떻게 하나요?',
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* 헤더 */}
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold text-gray-900">SOFA</span>
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
              데모
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </header>

      {/* 채팅 영역 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {/* 안내 배너 */}
          <div className="mb-6 rounded-lg bg-orange-50 p-4 text-sm text-orange-800">
            <p>
              <strong>데모 모드입니다.</strong> 실제 서비스에서는 업로드한 문서를 기반으로
              더 정확한 답변을 제공합니다.{' '}
              <Link href="/signup" className="underline hover:no-underline">
                지금 무료로 시작하세요!
              </Link>
            </p>
          </div>

          {/* 메시지 목록 */}
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  <div
                    className={`mt-1 text-xs ${
                      message.role === 'user' ? 'text-orange-100' : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* 타이핑 인디케이터 */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* 입력 영역 */}
      <footer className="border-t bg-white px-4 py-4">
        <div className="mx-auto max-w-4xl">
          {/* 예시 질문 버튼 */}
          <div className="mb-3 flex flex-wrap gap-2">
            {sampleQuestions.map((question) => (
              <button
                key={question}
                onClick={() => handleSend(question)}
                disabled={isTyping}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          {/* 입력 폼 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={isTyping}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              전송
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
