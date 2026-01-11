// app/(console)/console/chatbot/blog/_components/reconstructed-editor.tsx

'use client';

import { useRef, useEffect } from 'react';

interface ReconstructedEditorProps {
  value: string;
  onChange: (value: string) => void;
  highlightedRange?: {
    startLine: number;
    endLine: number;
    startChar: number;
    endChar: number;
  };
}

export function ReconstructedEditor({
  value,
  onChange,
  highlightedRange,
}: ReconstructedEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 하이라이트된 위치로 스크롤
  useEffect(() => {
    if (highlightedRange && textareaRef.current) {
      textareaRef.current.setSelectionRange(
        highlightedRange.startChar,
        highlightedRange.endChar
      );
      textareaRef.current.focus();

      // 스크롤 위치 조정
      const lineHeight = 20;
      const scrollTop = (highlightedRange.startLine - 5) * lineHeight;
      textareaRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, [highlightedRange]);

  return (
    <div className="flex h-full flex-col">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 resize-none border-none bg-transparent p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-0"
        placeholder="재구성된 마크다운..."
      />
    </div>
  );
}
