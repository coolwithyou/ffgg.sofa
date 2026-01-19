'use client';

/**
 * 마크다운 에디터 컴포넌트
 * CodeMirror 6 기반의 마크다운 문법 하이라이팅 에디터
 */

import { useEffect, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import CodeMirror from '@uiw/react-codemirror';
import { cn } from '@/lib/utils';
import {
  createMarkdownEditorTheme,
  getMarkdownExtensions,
} from '@/lib/codemirror/theme';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
  readOnly?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '마크다운으로 콘텐츠를 작성하세요...',
  className,
  height = '100%',
  readOnly = false,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  // 공통 마크다운 확장 기능
  const extensions = useMemo(() => getMarkdownExtensions(), []);

  // 공통 테마
  const theme = useMemo(() => createMarkdownEditorTheme(isDark), [isDark]);

  // SSR hydration mismatch 방지
  if (!mounted) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] w-full rounded-md border border-border bg-transparent',
          className
        )}
        style={{ height }}
      >
        <div className="flex-1 p-4 text-muted-foreground">{placeholder}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full overflow-hidden rounded-md border border-border bg-transparent transition-colors',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        readOnly && 'cursor-not-allowed opacity-60',
        className
      )}
      style={{ height }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={theme}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          history: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
        }}
        className="flex-1 overflow-auto"
        style={{ height: '100%' }}
      />
    </div>
  );
}
