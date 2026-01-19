// app/(console)/console/chatbot/blog/_components/reconstructed-editor.tsx

'use client';

/**
 * 재구성 마크다운 에디터 컴포넌트
 * CodeMirror 6 기반의 마크다운 문법 하이라이팅 + 범위 하이라이트 지원
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import {
  createMarkdownEditorTheme,
  getMarkdownExtensions,
  getHighlightRangeStyles,
} from '@/lib/codemirror/theme';

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

  // 공통 마크다운 확장 + 범위 하이라이트 지원
  const extensions = useMemo(
    () => [...getMarkdownExtensions(), highlightField],
    []
  );

  // 공통 테마 + 하이라이트 범위 스타일
  const theme = useMemo(
    () => createMarkdownEditorTheme(isDark, getHighlightRangeStyles(isDark)),
    [isDark]
  );

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
          foldGutter: true,
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
