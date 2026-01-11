// app/(console)/console/chatbot/blog/_components/original-viewer.tsx

'use client';

import { useRef, useEffect } from 'react';
import type { sourceSpans } from '@/drizzle/schema';

type SourceSpan = typeof sourceSpans.$inferSelect;

interface OriginalViewerProps {
  content: string;
  highlightedSpans: SourceSpan[];
}

export function OriginalViewer({ content, highlightedSpans }: OriginalViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 하이라이트된 스팬으로 스크롤
  useEffect(() => {
    if (highlightedSpans.length > 0 && containerRef.current) {
      const firstHighlight = containerRef.current.querySelector(
        '[data-highlight="true"]'
      );
      if (firstHighlight) {
        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedSpans]);

  // 하이라이트 적용된 HTML 생성
  const renderContent = () => {
    if (highlightedSpans.length === 0) {
      return (
        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
          {content}
        </pre>
      );
    }

    // 스팬을 시작 위치로 정렬
    const sortedSpans = [...highlightedSpans].sort((a, b) => a.startChar - b.startChar);

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    sortedSpans.forEach((span, index) => {
      // 하이라이트 전 텍스트
      if (span.startChar > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>{content.slice(lastEnd, span.startChar)}</span>
        );
      }

      // 하이라이트된 텍스트
      parts.push(
        <mark
          key={`highlight-${index}`}
          data-highlight="true"
          className="rounded bg-yellow-300/50 px-0.5 dark:bg-yellow-500/30"
        >
          {content.slice(span.startChar, span.endChar)}
        </mark>
      );

      lastEnd = span.endChar;
    });

    // 마지막 텍스트
    if (lastEnd < content.length) {
      parts.push(<span key="text-last">{content.slice(lastEnd)}</span>);
    }

    return (
      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
        {parts}
      </pre>
    );
  };

  return (
    <div ref={containerRef} className="p-4">
      {renderContent()}
    </div>
  );
}
