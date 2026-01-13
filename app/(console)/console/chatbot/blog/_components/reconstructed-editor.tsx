// app/(console)/console/chatbot/blog/_components/reconstructed-editor.tsx

'use client';

/**
 * 재구성 마크다운 에디터 컴포넌트
 * CodeMirror 6 기반의 마크다운 문법 하이라이팅 + 범위 하이라이트 지원
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTheme } from 'next-themes';
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { highlightSpecialChars } from '@codemirror/view';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { useRef } from 'react';

// 하이라이트 범위 설정을 위한 Effect
const setHighlightEffect = StateEffect.define<{ from: number; to: number } | null>();

// 하이라이트 데코레이션을 관리하는 StateField
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightEffect)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        const { from, to } = effect.value;
        const deco = Decoration.mark({
          class: 'cm-highlighted-range',
        }).range(from, to);
        return Decoration.set([deco]);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

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
      // 특수 문자 (탭, 스페이스 등) 시각화
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
      // 하이라이트 범위 (페이지 구조 선택, Claim 위치 등)
      '.cm-highlighted-range': {
        backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.35)',
        borderRadius: '2px',
      },
    },
    { dark: isDark }
  );
}

interface ReconstructedEditorProps {
  value: string;
  onChange: (value: string) => void;
  highlightedRange?: {
    startLine: number;
    endLine: number;
    startChar: number;
    endChar: number;
  };
  readOnly?: boolean;
  placeholder?: string;
}

export function ReconstructedEditor({
  value,
  onChange,
  highlightedRange,
  readOnly = false,
  placeholder = '재구성된 마크다운...',
}: ReconstructedEditorProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

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
      highlightSpecialChars(), // 특수 문자 시각화 (탭, 제어문자 등)
      highlightField, // 범위 하이라이트 지원
    ],
    []
  );

  const theme = useMemo(() => createEditorTheme(isDark), [isDark]);

  // 하이라이트 범위 업데이트
  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;

    if (highlightedRange) {
      const { startChar, endChar } = highlightedRange;
      const docLength = view.state.doc.length;

      // 범위 검증
      const from = Math.max(0, Math.min(startChar, docLength));
      const to = Math.max(from, Math.min(endChar, docLength));

      view.dispatch({
        effects: setHighlightEffect.of({ from, to }),
        // 하이라이트된 위치로 스크롤
        selection: { anchor: from },
      });

      // 부드러운 스크롤로 해당 위치로 이동
      const line = view.state.doc.lineAt(from);
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, {
          y: 'center',
        }),
      });
    } else {
      // 하이라이트 제거
      view.dispatch({
        effects: setHighlightEffect.of(null),
      });
    }
  }, [highlightedRange]);

  // SSR hydration mismatch 방지
  if (!mounted) {
    return (
      <div className="flex h-full min-h-[200px] w-full bg-transparent">
        <div className="flex-1 p-4 text-muted-foreground">{placeholder}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={theme}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true, // 코드 폴딩 활성화
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
