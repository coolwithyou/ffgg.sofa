/**
 * CodeMirror 6 공통 테마 및 확장 기능
 *
 * 마크다운 에디터에서 사용하는 공통 스타일과 확장 기능을 제공합니다.
 * 테마는 다크/라이트 모드를 자동 지원하며, 추가 스타일 확장이 가능합니다.
 */

import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { highlightSpecialChars } from '@codemirror/view';

/**
 * 추가 스타일 타입 정의
 */
type ThemeSpec = Record<string, Record<string, string>>;

/**
 * 기본 에디터 스타일 생성
 * 에디터 기본 구조 (배경, 커서, 선택, gutter 등)
 */
function getBaseEditorStyles(isDark: boolean): ThemeSpec {
  return {
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
    '.cm-specialChar': {
      color: isDark ? 'hsl(240 5% 40%)' : 'hsl(240 5% 70%)',
    },
  };
}

/**
 * 마크다운 문법 하이라이팅 스타일
 */
function getMarkdownSyntaxStyles(isDark: boolean): ThemeSpec {
  return {
    // 헤더
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
    // 텍스트 서식
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
    // 링크
    '.cm-link': {
      color: isDark ? 'hsl(199 89% 70%)' : 'hsl(199 89% 48%)',
      textDecoration: 'underline',
    },
    '.cm-url': {
      color: isDark ? 'hsl(199 89% 60%)' : 'hsl(199 89% 40%)',
      opacity: '0.7',
    },
    // 블록 요소
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
  };
}

/**
 * 마크다운 에디터 테마 생성
 *
 * @param isDark - 다크 모드 여부
 * @param additionalStyles - 추가할 커스텀 스타일 (선택)
 * @returns CodeMirror Extension
 *
 * @example
 * // 기본 사용
 * const theme = createMarkdownEditorTheme(true);
 *
 * @example
 * // 커스텀 스타일 추가 (하이라이트 범위 등)
 * const theme = createMarkdownEditorTheme(isDark, {
 *   '.cm-highlighted-range': {
 *     backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.35)',
 *     borderRadius: '2px',
 *   },
 * });
 */
export function createMarkdownEditorTheme(
  isDark: boolean,
  additionalStyles?: ThemeSpec
): Extension {
  const baseStyles = getBaseEditorStyles(isDark);
  const syntaxStyles = getMarkdownSyntaxStyles(isDark);

  return EditorView.theme(
    {
      ...baseStyles,
      ...syntaxStyles,
      ...additionalStyles,
    },
    { dark: isDark }
  );
}

/**
 * 기본 마크다운 에디터 확장 기능
 * - 마크다운 언어 지원 (코드 블록 내 언어 하이라이팅 포함)
 * - 줄 바꿈
 * - 특수 문자 시각화 (탭, 제어문자 등)
 *
 * @returns CodeMirror Extension 배열
 */
export function getMarkdownExtensions(): Extension[] {
  return [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    EditorView.lineWrapping,
    highlightSpecialChars(),
  ];
}

/**
 * 범위 하이라이트용 추가 스타일
 * PageStructurePreview, ClaimPanel 등에서 특정 범위를 하이라이트할 때 사용
 */
export function getHighlightRangeStyles(isDark: boolean): ThemeSpec {
  return {
    '.cm-highlighted-range': {
      backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.35)',
      borderRadius: '2px',
    },
  };
}
