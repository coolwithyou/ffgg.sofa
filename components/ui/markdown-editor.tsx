'use client';

/**
 * 마크다운 에디터 컴포넌트
 * CodeMirror 6 기반의 마크다운 문법 하이라이팅 에디터
 */

import { useEffect, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { highlightSpecialChars } from '@codemirror/view';
import { cn } from '@/lib/utils';

// 에디터 테마 생성 함수
function createEditorTheme(isDark: boolean) {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'transparent',
        height: '100%',
      },
      '.cm-content': {
        caretColor: isDark ? '#fff' : '#000',
        fontFamily: 'inherit',
        fontSize: '14px',
        lineHeight: '1.625',
        padding: '16px',
      },
      '.cm-cursor': {
        borderLeftColor: isDark ? '#fff' : '#000',
      },
      '.cm-selectionBackground': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        color: isDark ? 'hsl(210 100% 80%)' : 'hsl(210 100% 40%)',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? 'hsl(240 3.7% 15.9%)' : 'hsl(240 4.8% 95.9%)',
        color: isDark ? 'hsl(240 5% 50%)' : 'hsl(240 5% 60%)',
        border: 'none',
        borderRight: `1px solid ${isDark ? 'hsl(240 3.7% 20%)' : 'hsl(240 5.9% 90%)'}`,
        paddingRight: '8px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        paddingLeft: '12px',
        paddingRight: '8px',
        minWidth: '40px',
        fontSize: '12px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '.cm-placeholder': {
        color: isDark ? 'hsl(240 5% 64.9%)' : 'hsl(240 3.8% 46.1%)',
        fontStyle: 'normal',
      },
      // 특수 문자 (탭, 제어문자 등) 시각화
      '.cm-specialChar': {
        color: isDark ? 'hsl(240 5% 40%)' : 'hsl(240 5% 70%)',
      },
      // 마크다운 문법 하이라이팅
      '.cm-header': {
        fontWeight: '600',
        color: isDark ? 'hsl(210 100% 80%)' : 'hsl(210 100% 40%)',
      },
      '.cm-header-1': {
        fontSize: '1.5em',
      },
      '.cm-header-2': {
        fontSize: '1.3em',
      },
      '.cm-header-3': {
        fontSize: '1.1em',
      },
      '.cm-strong': {
        fontWeight: '700',
        color: isDark ? 'hsl(0 0% 100%)' : 'hsl(0 0% 10%)',
      },
      '.cm-emphasis': {
        fontStyle: 'italic',
        color: isDark ? 'hsl(280 60% 75%)' : 'hsl(280 60% 40%)',
      },
      '.cm-strikethrough': {
        textDecoration: 'line-through',
        color: isDark ? 'hsl(240 5% 64.9%)' : 'hsl(240 3.8% 46.1%)',
      },
      '.cm-link': {
        color: isDark ? 'hsl(199 89% 70%)' : 'hsl(199 89% 48%)',
        textDecoration: 'underline',
      },
      '.cm-url': {
        color: isDark ? 'hsl(199 89% 60%)' : 'hsl(199 89% 40%)',
        opacity: '0.7',
      },
      '.cm-quote': {
        color: isDark ? 'hsl(120 30% 70%)' : 'hsl(120 30% 40%)',
        borderLeft: `3px solid ${isDark ? 'hsl(240 5% 34.9%)' : 'hsl(240 5.9% 84.9%)'}`,
        paddingLeft: '12px',
      },
      '.cm-list': {
        color: isDark ? 'hsl(25 95% 70%)' : 'hsl(25 95% 53%)',
      },
      '.cm-hr': {
        color: isDark ? 'hsl(240 5% 64.9%)' : 'hsl(240 3.8% 46.1%)',
      },
      '.cm-image': {
        color: isDark ? 'hsl(280 60% 75%)' : 'hsl(280 60% 40%)',
      },
      '.cm-formatting': {
        color: isDark ? 'hsl(240 5% 50%)' : 'hsl(240 5% 60%)',
      },
      // 코드 블록
      '.cm-inline-code': {
        backgroundColor: isDark ? 'hsl(240 3.7% 15.9%)' : 'hsl(240 4.8% 95.9%)',
        padding: '2px 4px',
        borderRadius: '4px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.9em',
        color: isDark ? 'hsl(330 80% 75%)' : 'hsl(330 80% 45%)',
      },
      '.cm-codeblock': {
        backgroundColor: isDark ? 'hsl(240 3.7% 15.9%)' : 'hsl(240 4.8% 95.9%)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.9em',
      },
    },
    { dark: isDark }
  );
}

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

  // 테마와 확장 기능을 메모이제이션
  const extensions = useMemo(
    () => [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      EditorView.lineWrapping,
      highlightSpecialChars(), // 탭, 제어문자 등 시각화
    ],
    []
  );

  const theme = useMemo(() => createEditorTheme(isDark), [isDark]);

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
