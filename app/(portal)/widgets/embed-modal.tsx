'use client';

/**
 * 임베드 코드 모달
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, AlertTriangle } from 'lucide-react';
import { ChatbotWithWidgetStatus } from './actions';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatbot: ChatbotWithWidgetStatus | null;
}

type EmbedType = 'javascript' | 'iframe' | 'react';

export function EmbedModal({ isOpen, onClose, chatbot }: EmbedModalProps) {
  const [embedType, setEmbedType] = useState<EmbedType>('javascript');
  const [copied, setCopied] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // 복사 상태 리셋
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // 임베드 코드 생성
  const getEmbedCode = useCallback(() => {
    if (!chatbot?.widgetApiKey) return '';

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const apiKey = chatbot.widgetApiKey;

    switch (embedType) {
      case 'javascript':
        return `<!-- SOFA Chat Widget -->
<script
  src="${baseUrl}/widget.js"
  data-api-key="${apiKey}"
  async
></script>`;

      case 'iframe':
        return `<!-- SOFA Chat Widget (iframe) -->
<iframe
  src="${baseUrl}/widget/${chatbot.id}?key=${apiKey}"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); z-index: 99999;"
  allow="clipboard-write"
  loading="lazy"
></iframe>`;

      case 'react':
        return `// SOFA Chat Widget (React)
import { useEffect } from 'react';

export function SofaChatWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${baseUrl}/widget.js';
    script.async = true;
    script.setAttribute('data-api-key', '${apiKey}');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      // 위젯 요소 정리
      const widget = document.getElementById('sofa-chat-widget');
      const button = document.getElementById('sofa-chat-button');
      widget?.remove();
      button?.remove();
    };
  }, []);

  return null;
}`;

      default:
        return '';
    }
  }, [chatbot, embedType]);

  // 복사 핸들러
  const handleCopy = async () => {
    const code = getEmbedCode();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen || !chatbot) return null;

  const tabs: { id: EmbedType; label: string }[] = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'iframe', label: 'iframe' },
    { id: 'react', label: 'React' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              임베드 코드
            </h2>
            <p className="text-sm text-muted-foreground">{chatbot.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setEmbedType(tab.id)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                embedType === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 코드 블록 */}
        <div className="relative mb-4">
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-sm">
            <code className="text-foreground">{getEmbedCode()}</code>
          </pre>

          {/* 복사 버튼 */}
          <button
            onClick={handleCopy}
            className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                복사
              </>
            )}
          </button>
        </div>

        {/* 안내 사항 */}
        <div className="space-y-3">
          {/* 설치 안내 */}
          <div className="rounded-lg bg-primary/10 p-3">
            <h4 className="mb-1 text-sm font-medium text-primary">설치 방법</h4>
            <p className="text-sm text-muted-foreground">
              {embedType === 'javascript' && (
                <>
                  위 코드를 웹사이트의 <code className="text-primary">&lt;body&gt;</code> 태그
                  끝에 붙여넣으세요. 페이지 우측 하단에 채팅 버튼이 나타납니다.
                </>
              )}
              {embedType === 'iframe' && (
                <>
                  위 코드를 웹사이트에 붙여넣으세요. iframe은 고정 위치에 채팅창을
                  표시합니다. 스타일은 필요에 따라 수정할 수 있습니다.
                </>
              )}
              {embedType === 'react' && (
                <>
                  위 컴포넌트를 프로젝트에 추가하고, 앱의 최상위 레벨에서 렌더링하세요.
                  예: <code className="text-primary">&lt;SofaChatWidget /&gt;</code>
                </>
              )}
            </p>
          </div>

          {/* 주의 사항 */}
          <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">주의 사항</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>HTTPS 사이트에서만 정상 작동합니다.</li>
                <li>API 키는 공개되지만 도메인별 제한이 적용됩니다.</li>
                <li>한 페이지에 위젯을 중복 삽입하지 마세요.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
