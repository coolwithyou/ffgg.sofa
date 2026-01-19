// lib/knowledge-pages/verification/pdf-highlight.ts

/**
 * PDF 텍스트 레이어 하이라이트 유틸리티
 *
 * PDF.js의 텍스트 레이어에서 특정 텍스트의 좌표를 찾아 하이라이트합니다.
 */

export interface TextPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface HighlightRange {
  pageNumber: number;
  startChar: number;
  endChar: number;
  text: string;
}

/**
 * PDF 텍스트 레이어에서 특정 텍스트의 좌표를 찾는 유틸리티
 */
export function findTextPositionInPage(
  textLayerElement: HTMLElement,
  searchText: string
): TextPosition | null {
  const textSpans = textLayerElement.querySelectorAll('span');
  let accumulatedText = '';
  let startSpan: HTMLElement | null = null;
  let endSpan: HTMLElement | null = null;

  for (const span of textSpans) {
    const spanText = span.textContent || '';
    const prevLength = accumulatedText.length;
    accumulatedText += spanText;

    const searchIndex = accumulatedText.indexOf(searchText);
    if (searchIndex !== -1 && !startSpan) {
      // 시작 위치 찾음
      if (searchIndex >= prevLength) {
        startSpan = span as HTMLElement;
      }
    }

    if (startSpan && accumulatedText.length >= searchIndex + searchText.length) {
      endSpan = span as HTMLElement;
      break;
    }
  }

  if (!startSpan || !endSpan) return null;

  // 좌표 계산
  const startRect = startSpan.getBoundingClientRect();
  const endRect = endSpan.getBoundingClientRect();
  const containerRect = textLayerElement.getBoundingClientRect();

  return {
    top: startRect.top - containerRect.top,
    left: startRect.left - containerRect.left,
    width: endRect.right - startRect.left,
    height: Math.max(startRect.height, endRect.height),
  };
}

/**
 * 여러 텍스트 범위의 좌표를 찾습니다.
 */
export function findMultipleTextPositions(
  textLayerElement: HTMLElement,
  searchTexts: string[]
): Map<string, TextPosition | null> {
  const results = new Map<string, TextPosition | null>();

  for (const text of searchTexts) {
    results.set(text, findTextPositionInPage(textLayerElement, text));
  }

  return results;
}

/**
 * 페이지별 하이라이트 범위를 그룹핑합니다.
 */
export function groupHighlightsByPage(
  highlights: HighlightRange[]
): Map<number, HighlightRange[]> {
  const grouped = new Map<number, HighlightRange[]>();

  for (const highlight of highlights) {
    const pageHighlights = grouped.get(highlight.pageNumber) || [];
    pageHighlights.push(highlight);
    grouped.set(highlight.pageNumber, pageHighlights);
  }

  return grouped;
}

/**
 * 문자 인덱스를 페이지 번호로 변환합니다.
 */
export function charIndexToPage(
  charIndex: number,
  pageMapping: { pageNumber: number; startChar: number; endChar: number }[]
): number {
  for (const mapping of pageMapping) {
    if (charIndex >= mapping.startChar && charIndex < mapping.endChar) {
      return mapping.pageNumber;
    }
  }
  return 1; // 기본값
}

/**
 * 하이라이트 스타일을 생성합니다.
 */
export function createHighlightStyle(
  position: TextPosition,
  options: {
    backgroundColor?: string;
    borderColor?: string;
    opacity?: number;
  } = {}
): React.CSSProperties {
  const {
    backgroundColor = 'rgba(255, 235, 59, 0.4)',
    borderColor = 'rgba(255, 193, 7, 0.5)',
    opacity = 1,
  } = options;

  return {
    position: 'absolute',
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    backgroundColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '2px',
    pointerEvents: 'none',
    opacity,
  };
}

/**
 * 두 범위가 겹치는지 확인합니다.
 */
export function rangesOverlap(
  range1: { start: number; end: number },
  range2: { start: number; end: number }
): boolean {
  return range1.start < range2.end && range2.start < range1.end;
}

/**
 * 겹치는 범위를 병합합니다.
 */
export function mergeOverlappingRanges(
  ranges: { start: number; end: number }[]
): { start: number; end: number }[] {
  if (ranges.length === 0) return [];

  // 시작 위치로 정렬
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // 겹치면 병합
      last.end = Math.max(last.end, current.end);
    } else {
      // 겹치지 않으면 새로 추가
      merged.push(current);
    }
  }

  return merged;
}
