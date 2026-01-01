'use client';

/**
 * 임베드 코드 섹션
 * [Week 9] 위젯 설치 코드 표시
 */

import { useState } from 'react';

interface EmbedCodeSectionProps {
  code: string;
}

export function EmbedCodeSection({ code }: EmbedCodeSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* 코드 블록 */}
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className={`absolute right-2 top-2 rounded px-3 py-1 text-sm transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>

      {/* 설치 가이드 */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="font-medium text-blue-900">설치 방법</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-blue-800">
          <li>위의 코드를 복사합니다.</li>
          <li>
            웹사이트의 HTML에서 <code className="rounded bg-blue-100 px-1">&lt;/body&gt;</code> 태그
            직전에 붙여넣습니다.
          </li>
          <li>페이지를 새로고침하면 우측 하단에 챗봇 버튼이 표시됩니다.</li>
        </ol>
      </div>

      {/* 주의사항 */}
      <div className="rounded-lg bg-yellow-50 p-4">
        <h3 className="font-medium text-yellow-900">주의사항</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-800">
          <li>HTTPS 환경에서만 정상 동작합니다.</li>
          <li>Content Security Policy(CSP) 설정이 있는 경우 도메인을 허용해야 합니다.</li>
          <li>동일한 페이지에 코드를 두 번 이상 추가하지 마세요.</li>
        </ul>
      </div>
    </div>
  );
}
