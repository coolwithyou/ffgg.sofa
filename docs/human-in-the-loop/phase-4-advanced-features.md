# Phase 4: 고급 기능 (3일)

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | PDF 렌더링, 스크롤 동기화, 민감정보 마스킹, 감사 로그 |
| **산출물** | PDF Viewer 컴포넌트 + 스크롤 동기화 훅 + 마스킹 유틸 + 감사 테이블 |
| **의존성** | Phase 1-3 완료 |
| **예상 기간** | 3일 |

---

## 4.1 PDF 렌더링

### 패키지 설치

```bash
pnpm add react-pdf
```

### Next.js 설정

**파일**: `next.config.js`

```javascript
// next.config.js
module.exports = {
  webpack: (config) => {
    // canvas 모듈 비활성화 (Node.js 환경에서만 필요)
    config.resolve.alias.canvas = false;
    return config;
  },
};
```

### PDF Worker 설정

PDF.js Worker는 별도 스레드에서 PDF 파싱을 처리합니다. CDN 또는 로컬 파일로 설정 가능합니다.

**CDN 방식 (권장)**:
```typescript
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
```

**로컬 방식**:
```typescript
// public/pdf.worker.min.js로 복사 후
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

### PDF Viewer 컴포넌트

**파일**: `app/(console)/console/chatbot/blog/_components/pdf-viewer.tsx`

```tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  highlightedSpans: HighlightedSpan[];
  onTextExtracted?: (text: string, pageMapping: PageMapping[]) => void;
  className?: string;
}

interface HighlightedSpan {
  pageNumber: number;
  startChar: number;
  endChar: number;
  text: string;
}

interface PageMapping {
  pageNumber: number;
  startChar: number;
  endChar: number;
}

export function PdfViewer({
  url,
  highlightedSpans,
  onTextExtracted,
  className,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 문서 로드 성공 핸들러
  const onDocumentLoadSuccess = useCallback(
    async ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setIsLoading(false);

      // 텍스트 추출 및 페이지 매핑 생성
      if (onTextExtracted) {
        try {
          const pdf = await pdfjs.getDocument(url).promise;
          let fullText = '';
          const pageMapping: PageMapping[] = [];

          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');

            pageMapping.push({
              pageNumber: i,
              startChar: fullText.length,
              endChar: fullText.length + pageText.length,
            });

            fullText += pageText + '\n';
          }

          onTextExtracted(fullText, pageMapping);
        } catch (error) {
          console.error('PDF 텍스트 추출 실패:', error);
        }
      }
    },
    [url, onTextExtracted]
  );

  // 하이라이트된 페이지로 자동 이동
  useEffect(() => {
    if (highlightedSpans.length > 0) {
      const firstHighlight = highlightedSpans[0];
      if (firstHighlight.pageNumber !== currentPage) {
        setCurrentPage(firstHighlight.pageNumber);
      }
    }
  }, [highlightedSpans]);

  // 페이지 이동
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(numPages, page)));
  };

  // 줌 조절
  const adjustZoom = (delta: number) => {
    setScale((prev) => Math.max(0.5, Math.min(2.5, prev + delta)));
  };

  // 하이라이트 오버레이 렌더링
  const renderHighlights = (pageNumber: number) => {
    const pageHighlights = highlightedSpans.filter(
      (span) => span.pageNumber === pageNumber
    );

    if (pageHighlights.length === 0) return null;

    return (
      <div className="absolute inset-0 pointer-events-none">
        {pageHighlights.map((span, index) => (
          <div
            key={index}
            className="absolute bg-yellow-300/40 border border-yellow-500/50 rounded-sm"
            data-highlight-id={`${pageNumber}-${index}`}
            // 실제 위치는 텍스트 레이어 좌표 기반으로 계산 필요
            // 아래는 예시 스타일
            style={{
              // TODO: 텍스트 레이어에서 실제 좌표 계산
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 툴바 */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        {/* 페이지 네비게이션 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {currentPage} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 줌 컨트롤 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => adjustZoom(-0.1)}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => adjustZoom(0.1)}
            disabled={scale >= 2.5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF 렌더링 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 bg-muted/20"
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => {
            console.error('PDF 로드 실패:', error);
            setIsLoading(false);
          }}
          loading={
            <div className="flex items-center justify-center h-40">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-40 text-destructive">
              PDF 파일을 불러올 수 없습니다
            </div>
          }
        >
          <div className="relative inline-block shadow-lg">
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="bg-white"
            />
            {renderHighlights(currentPage)}
          </div>
        </Document>
      </div>
    </div>
  );
}
```

### 텍스트 레이어 하이라이트

PDF.js의 텍스트 레이어에서 정확한 위치를 찾아 하이라이트하는 유틸리티:

**파일**: `lib/knowledge-pages/verification/pdf-highlight.ts`

```typescript
/**
 * PDF 텍스트 레이어에서 특정 텍스트의 좌표를 찾는 유틸리티
 */
export function findTextPositionInPage(
  textLayerElement: HTMLElement,
  searchText: string
): { top: number; left: number; width: number; height: number } | null {
  const textSpans = textLayerElement.querySelectorAll('span');
  let accumulatedText = '';
  let startSpan: HTMLElement | null = null;
  let endSpan: HTMLElement | null = null;
  let startOffset = 0;

  for (const span of textSpans) {
    const spanText = span.textContent || '';
    const prevLength = accumulatedText.length;
    accumulatedText += spanText;

    const searchIndex = accumulatedText.indexOf(searchText);
    if (searchIndex !== -1 && !startSpan) {
      // 시작 위치 찾음
      if (searchIndex >= prevLength) {
        startSpan = span as HTMLElement;
        startOffset = searchIndex - prevLength;
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
```

---

## 4.2 스크롤 동기화

원본 문서와 재구성 문서 간 스크롤을 동기화하는 훅입니다.

### 동기화 전략

1. **비율 기반 동기화**: 스크롤 위치를 퍼센트로 환산하여 동기화
2. **매핑 기반 동기화**: 원본↔재구성 위치 매핑 테이블 사용 (더 정확)
3. **하이브리드**: 매핑이 있으면 매핑 사용, 없으면 비율 사용

### useScrollSync 훅

**파일**: `app/(console)/console/chatbot/blog/_components/use-scroll-sync.ts`

```typescript
import { useRef, useEffect, useCallback } from 'react';

interface ScrollMapping {
  originalStart: number;  // 원본 문서에서의 문자 위치
  originalEnd: number;
  reconstructedStart: number;  // 재구성 문서에서의 문자 위치
  reconstructedEnd: number;
}

interface UseScrollSyncOptions {
  enabled: boolean;
  leftRef: React.RefObject<HTMLDivElement>;
  rightRef: React.RefObject<HTMLDivElement>;
  mappings?: ScrollMapping[];
  mode?: 'ratio' | 'mapping' | 'hybrid';
}

/**
 * 스크롤 동기화 훅
 *
 * 원본 ↔ 재구성 문서 간 스크롤을 동기화합니다.
 * 한쪽을 스크롤하면 다른 쪽도 해당 위치로 이동합니다.
 */
export function useScrollSync({
  enabled,
  leftRef,
  rightRef,
  mappings = [],
  mode = 'hybrid',
}: UseScrollSyncOptions) {
  // 스크롤 이벤트 루프 방지용 플래그
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastScrollSourceRef = useRef<'left' | 'right' | null>(null);

  // 비율 기반 동기화
  const syncByRatio = useCallback(
    (source: HTMLDivElement, target: HTMLDivElement) => {
      const sourceScrollRatio =
        source.scrollTop / (source.scrollHeight - source.clientHeight);
      const targetScrollTop =
        sourceScrollRatio * (target.scrollHeight - target.clientHeight);

      target.scrollTop = targetScrollTop;
    },
    []
  );

  // 매핑 기반 동기화 (더 정확한 위치 매핑)
  const syncByMapping = useCallback(
    (
      source: HTMLDivElement,
      target: HTMLDivElement,
      isLeftToRight: boolean
    ) => {
      if (mappings.length === 0) {
        syncByRatio(source, target);
        return;
      }

      // 현재 스크롤 위치에 해당하는 문자 위치 추정
      const scrollRatio =
        source.scrollTop / (source.scrollHeight - source.clientHeight);
      const estimatedCharPosition = Math.floor(
        scrollRatio * (isLeftToRight ? getMaxOriginal() : getMaxReconstructed())
      );

      // 해당 위치에 가장 가까운 매핑 찾기
      const mapping = findClosestMapping(estimatedCharPosition, isLeftToRight);
      if (!mapping) {
        syncByRatio(source, target);
        return;
      }

      // 타겟 문서에서의 비율 계산
      const targetCharPosition = isLeftToRight
        ? mapping.reconstructedStart
        : mapping.originalStart;
      const targetTotal = isLeftToRight
        ? getMaxReconstructed()
        : getMaxOriginal();
      const targetRatio = targetCharPosition / targetTotal;

      target.scrollTop =
        targetRatio * (target.scrollHeight - target.clientHeight);
    },
    [mappings, syncByRatio]
  );

  const getMaxOriginal = () =>
    Math.max(...mappings.map((m) => m.originalEnd), 1);
  const getMaxReconstructed = () =>
    Math.max(...mappings.map((m) => m.reconstructedEnd), 1);

  const findClosestMapping = (
    charPosition: number,
    isOriginal: boolean
  ): ScrollMapping | null => {
    if (mappings.length === 0) return null;

    return mappings.reduce((closest, current) => {
      const currentPos = isOriginal
        ? current.originalStart
        : current.reconstructedStart;
      const closestPos = isOriginal
        ? closest.originalStart
        : closest.reconstructedStart;

      return Math.abs(currentPos - charPosition) <
        Math.abs(closestPos - charPosition)
        ? current
        : closest;
    });
  };

  // 왼쪽 패널 스크롤 핸들러
  const handleLeftScroll = useCallback(() => {
    if (!enabled || isScrollingRef.current) return;
    if (!leftRef.current || !rightRef.current) return;

    // 이미 오른쪽에서 스크롤 중이면 무시
    if (lastScrollSourceRef.current === 'right') return;

    lastScrollSourceRef.current = 'left';
    isScrollingRef.current = true;

    if (mode === 'ratio') {
      syncByRatio(leftRef.current, rightRef.current);
    } else if (mode === 'mapping') {
      syncByMapping(leftRef.current, rightRef.current, true);
    } else {
      // hybrid: 매핑이 있으면 매핑 사용
      if (mappings.length > 0) {
        syncByMapping(leftRef.current, rightRef.current, true);
      } else {
        syncByRatio(leftRef.current, rightRef.current);
      }
    }

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      lastScrollSourceRef.current = null;
    }, 150);
  }, [enabled, leftRef, rightRef, mode, mappings, syncByRatio, syncByMapping]);

  // 오른쪽 패널 스크롤 핸들러
  const handleRightScroll = useCallback(() => {
    if (!enabled || isScrollingRef.current) return;
    if (!leftRef.current || !rightRef.current) return;

    if (lastScrollSourceRef.current === 'left') return;

    lastScrollSourceRef.current = 'right';
    isScrollingRef.current = true;

    if (mode === 'ratio') {
      syncByRatio(rightRef.current, leftRef.current);
    } else if (mode === 'mapping') {
      syncByMapping(rightRef.current, leftRef.current, false);
    } else {
      if (mappings.length > 0) {
        syncByMapping(rightRef.current, leftRef.current, false);
      } else {
        syncByRatio(rightRef.current, leftRef.current);
      }
    }

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      lastScrollSourceRef.current = null;
    }, 150);
  }, [enabled, leftRef, rightRef, mode, mappings, syncByRatio, syncByMapping]);

  // 이벤트 리스너 등록
  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;

    if (!leftEl || !rightEl || !enabled) return;

    leftEl.addEventListener('scroll', handleLeftScroll, { passive: true });
    rightEl.addEventListener('scroll', handleRightScroll, { passive: true });

    return () => {
      leftEl.removeEventListener('scroll', handleLeftScroll);
      rightEl.removeEventListener('scroll', handleRightScroll);
      clearTimeout(scrollTimeoutRef.current);
    };
  }, [enabled, leftRef, rightRef, handleLeftScroll, handleRightScroll]);
}
```

### 스크롤 동기화 UI 토글

**파일**: `app/(console)/console/chatbot/blog/_components/scroll-sync-toggle.tsx`

```tsx
'use client';

import { Link2, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ScrollSyncToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ScrollSyncToggle({ enabled, onToggle }: ScrollSyncToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToggle(!enabled)}
          className="gap-1"
        >
          {enabled ? (
            <>
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">동기화 켜짐</span>
            </>
          ) : (
            <>
              <Link2Off className="h-4 w-4" />
              <span className="hidden sm:inline">동기화 꺼짐</span>
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>스크롤 동기화 {enabled ? '비활성화' : '활성화'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## 4.3 민감정보 마스킹

개인정보 보호를 위한 자동 마스킹 유틸리티입니다.

### 지원 유형

| 유형 | 패턴 | 마스킹 결과 |
|------|------|------------|
| 전화번호 | `010-1234-5678` | `010-****-5678` |
| 이메일 | `user@example.com` | `us****@example.com` |
| 주민등록번호 | `901231-1234567` | `901231-*******` |
| 카드번호 | `1234-5678-9012-3456` | `1234-****-****-3456` |
| 계좌번호 | `123456789012` | `1234****9012` |

### 마스킹 함수

**파일**: `lib/knowledge-pages/verification/masking.ts`

```typescript
export interface MaskingResult {
  maskedText: string;
  maskings: MaskingEntry[];
}

export interface MaskingEntry {
  type: 'phone' | 'email' | 'rrn' | 'card' | 'account';
  original: string;
  masked: string;
  startChar: number;
  endChar: number;
}

/**
 * 민감정보 자동 마스킹
 *
 * 텍스트에서 개인정보를 탐지하고 마스킹합니다.
 * 마스킹된 위치 정보도 함께 반환하여 필요 시 복원 가능합니다.
 */
export function maskSensitiveInfo(text: string): MaskingResult {
  let maskedText = text;
  const maskings: MaskingEntry[] = [];
  let offset = 0;

  // 1. 전화번호 마스킹
  const phoneRegex = /(0\d{1,2})([-.\s]?)(\d{3,4})([-.\s]?)(\d{4})/g;
  maskedText = maskedText.replace(
    phoneRegex,
    (match, p1, s1, p2, s2, p3, matchOffset) => {
      const masked = `${p1}${s1}****${s2}${p3}`;
      maskings.push({
        type: 'phone',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 2. 이메일 마스킹
  const emailRegex = /([\w.-]{2})([\w.-]*)(@[\w.-]+\.\w+)/g;
  maskedText = maskedText.replace(
    emailRegex,
    (match, p1, p2, p3, matchOffset) => {
      const maskedMiddle = '*'.repeat(Math.min(4, Math.max(2, p2.length)));
      const masked = `${p1}${maskedMiddle}${p3}`;
      maskings.push({
        type: 'email',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 3. 주민등록번호 마스킹 (13자리)
  const rrnRegex = /(\d{6})([-\s]?)(\d{7})/g;
  maskedText = maskedText.replace(
    rrnRegex,
    (match, p1, separator, p2, matchOffset) => {
      const masked = `${p1}${separator}*******`;
      maskings.push({
        type: 'rrn',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 4. 카드번호 마스킹 (16자리)
  const cardRegex = /(\d{4})([-\s]?)(\d{4})([-\s]?)(\d{4})([-\s]?)(\d{4})/g;
  maskedText = maskedText.replace(
    cardRegex,
    (match, p1, s1, p2, s2, p3, s3, p4, matchOffset) => {
      const masked = `${p1}${s1}****${s2}****${s3}${p4}`;
      maskings.push({
        type: 'card',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 5. 계좌번호 마스킹 (10-14자리 숫자)
  const accountRegex = /(\d{3,4})(\d{4,6})(\d{3,4})/g;
  maskedText = maskedText.replace(
    accountRegex,
    (match, p1, p2, p3, matchOffset) => {
      // 이미 다른 패턴으로 마스킹된 경우 스킵
      if (maskings.some((m) => m.startChar <= matchOffset && m.endChar >= matchOffset)) {
        return match;
      }
      const masked = `${p1}${'*'.repeat(p2.length)}${p3}`;
      maskings.push({
        type: 'account',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  return { maskedText, maskings };
}

/**
 * 마스킹 해제 (권한 있는 사용자만)
 *
 * 마스킹된 텍스트와 마스킹 정보를 사용하여 원본 복원
 */
export function unmaskSensitiveInfo(
  maskedText: string,
  maskings: MaskingEntry[]
): string {
  // 역순으로 처리하여 위치가 변하지 않도록
  const sortedMaskings = [...maskings].sort(
    (a, b) => b.startChar - a.startChar
  );

  let unmaskedText = maskedText;

  for (const masking of sortedMaskings) {
    unmaskedText =
      unmaskedText.slice(0, masking.startChar) +
      masking.original +
      unmaskedText.slice(masking.startChar + masking.masked.length);
  }

  return unmaskedText;
}

/**
 * 민감정보 탐지 (마스킹 없이 탐지만)
 */
export function detectSensitiveInfo(text: string): {
  type: MaskingEntry['type'];
  text: string;
  startChar: number;
  endChar: number;
}[] {
  const detected: {
    type: MaskingEntry['type'];
    text: string;
    startChar: number;
    endChar: number;
  }[] = [];

  const patterns: { type: MaskingEntry['type']; regex: RegExp }[] = [
    { type: 'phone', regex: /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g },
    { type: 'email', regex: /[\w.-]+@[\w.-]+\.\w+/g },
    { type: 'rrn', regex: /\d{6}[-\s]?\d{7}/g },
    { type: 'card', regex: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g },
  ];

  for (const { type, regex } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      detected.push({
        type,
        text: match[0],
        startChar: match.index,
        endChar: match.index + match[0].length,
      });
    }
  }

  return detected.sort((a, b) => a.startChar - b.startChar);
}
```

### 마스킹 배지 컴포넌트

**파일**: `app/(console)/console/chatbot/blog/_components/masking-badge.tsx`

```tsx
'use client';

import { Shield, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MaskingEntry } from '@/lib/knowledge-pages/verification/masking';

interface MaskingBadgeProps {
  maskings: MaskingEntry[];
  isRevealed: boolean;
  onToggleReveal: () => void;
  canReveal?: boolean;
}

const typeLabels: Record<MaskingEntry['type'], string> = {
  phone: '전화번호',
  email: '이메일',
  rrn: '주민번호',
  card: '카드번호',
  account: '계좌번호',
};

export function MaskingBadge({
  maskings,
  isRevealed,
  onToggleReveal,
  canReveal = false,
}: MaskingBadgeProps) {
  if (maskings.length === 0) return null;

  const groupedByType = maskings.reduce((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="gap-1 cursor-default"
          >
            <ShieldAlert className="h-3 w-3" />
            {maskings.length}개 마스킹됨
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {Object.entries(groupedByType).map(([type, count]) => (
              <div key={type} className="text-xs">
                {typeLabels[type as MaskingEntry['type']]}: {count}개
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>

      {canReveal && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleReveal}
          className="h-6 px-2 text-xs"
        >
          {isRevealed ? (
            <>
              <EyeOff className="h-3 w-3 mr-1" />
              숨기기
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-1" />
              보기
            </>
          )}
        </Button>
      )}
    </div>
  );
}
```

---

## 4.4 감사 로그

검증 과정의 모든 액션을 기록하는 감사 로그 시스템입니다.

### 감사 로그 테이블

**파일**: `drizzle/schema.ts` (추가)

```typescript
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * 검증 감사 로그
 *
 * 누가, 언제, 어떤 검증 액션을 수행했는지 기록합니다.
 * 컴플라이언스 및 감사 추적용입니다.
 */
export const validationAuditLogs = pgTable(
  'validation_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => validationSessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // 액션 유형
    action: text('action', {
      enum: [
        'session_viewed',      // 세션 열람
        'session_approved',    // 세션 승인
        'session_rejected',    // 세션 거부
        'claim_reviewed',      // Claim 검토
        'claim_approved',      // Claim 승인
        'claim_rejected',      // Claim 거부
        'claim_modified',      // Claim 수정
        'markdown_edited',     // 마크다운 수정
        'masking_applied',     // 마스킹 적용
        'masking_revealed',    // 마스킹 해제
        'export_generated',    // 리포트 생성
      ],
    }).notNull(),

    // 대상 (Claim ID 등)
    targetType: text('target_type', {
      enum: ['session', 'claim', 'markdown'],
    }),
    targetId: text('target_id'),

    // 변경 내역
    previousValue: text('previous_value'),
    newValue: text('new_value'),

    // 추가 메타데이터
    metadata: jsonb('metadata').$type<{
      reason?: string;
      claimText?: string;
      verdict?: string;
      [key: string]: any;
    }>(),

    // 클라이언트 정보
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // 타임스탬프
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_session').on(table.sessionId),
    index('idx_audit_logs_user').on(table.userId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_created').on(table.createdAt),
  ]
);

export type ValidationAuditLog = typeof validationAuditLogs.$inferSelect;
export type NewValidationAuditLog = typeof validationAuditLogs.$inferInsert;
```

### 감사 로그 서비스

**파일**: `lib/knowledge-pages/verification/audit-logger.ts`

```typescript
import { db } from '@/lib/db';
import { validationAuditLogs } from '@/drizzle/schema';
import { headers } from 'next/headers';

type AuditAction = typeof validationAuditLogs.$inferInsert['action'];

interface LogAuditOptions {
  sessionId: string;
  userId: string;
  action: AuditAction;
  targetType?: 'session' | 'claim' | 'markdown';
  targetId?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}

/**
 * 감사 로그 기록
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  const {
    sessionId,
    userId,
    action,
    targetType,
    targetId,
    previousValue,
    newValue,
    metadata,
  } = options;

  // 클라이언트 정보 추출
  const headersList = headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    'unknown';
  const userAgent = headersList.get('user-agent') || 'unknown';

  try {
    await db.insert(validationAuditLogs).values({
      sessionId,
      userId,
      action,
      targetType,
      targetId,
      previousValue,
      newValue,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // 감사 로그 실패가 메인 로직을 중단시키면 안 됨
    console.error('Failed to log audit:', error);
  }
}

/**
 * 세션별 감사 로그 조회
 */
export async function getSessionAuditLogs(sessionId: string) {
  return db.query.validationAuditLogs.findMany({
    where: eq(validationAuditLogs.sessionId, sessionId),
    orderBy: [desc(validationAuditLogs.createdAt)],
    with: {
      user: {
        columns: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * 감사 로그 헬퍼 함수들
 */
export const auditHelpers = {
  sessionViewed: (sessionId: string, userId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'session_viewed',
      targetType: 'session',
      targetId: sessionId,
    }),

  sessionApproved: (sessionId: string, userId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'session_approved',
      targetType: 'session',
      targetId: sessionId,
    }),

  sessionRejected: (sessionId: string, userId: string, reason: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'session_rejected',
      targetType: 'session',
      targetId: sessionId,
      metadata: { reason },
    }),

  claimReviewed: (
    sessionId: string,
    userId: string,
    claimId: string,
    verdict: string,
    previousVerdict?: string
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'claim_reviewed',
      targetType: 'claim',
      targetId: claimId,
      previousValue: previousVerdict,
      newValue: verdict,
      metadata: { verdict },
    }),

  markdownEdited: (
    sessionId: string,
    userId: string,
    previousContent: string,
    newContent: string
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'markdown_edited',
      targetType: 'markdown',
      previousValue: previousContent.slice(0, 1000), // 너무 길면 잘라서 저장
      newValue: newContent.slice(0, 1000),
    }),

  maskingRevealed: (sessionId: string, userId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'masking_revealed',
      targetType: 'session',
      targetId: sessionId,
    }),
};
```

### 감사 로그 UI

**파일**: `app/(console)/console/chatbot/blog/_components/audit-log-panel.tsx`

```tsx
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { History, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ValidationAuditLog } from '@/drizzle/schema';

interface AuditLogPanelProps {
  logs: (ValidationAuditLog & { user: { name: string; email: string } })[];
}

const actionLabels: Record<string, { label: string; color: string }> = {
  session_viewed: { label: '세션 열람', color: 'bg-muted text-muted-foreground' },
  session_approved: { label: '승인', color: 'bg-green-500/10 text-green-500' },
  session_rejected: { label: '거부', color: 'bg-destructive/10 text-destructive' },
  claim_reviewed: { label: 'Claim 검토', color: 'bg-primary/10 text-primary' },
  claim_approved: { label: 'Claim 승인', color: 'bg-green-500/10 text-green-500' },
  claim_rejected: { label: 'Claim 거부', color: 'bg-destructive/10 text-destructive' },
  claim_modified: { label: 'Claim 수정', color: 'bg-yellow-500/10 text-yellow-500' },
  markdown_edited: { label: '마크다운 수정', color: 'bg-purple-500/10 text-purple-500' },
  masking_applied: { label: '마스킹 적용', color: 'bg-blue-500/10 text-blue-500' },
  masking_revealed: { label: '마스킹 해제', color: 'bg-orange-500/10 text-orange-500' },
};

export function AuditLogPanel({ logs }: AuditLogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        기록된 활동이 없습니다
      </div>
    );
  }

  const displayLogs = isExpanded ? logs : logs.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <History className="h-4 w-4" />
          활동 기록
        </h4>
        <span className="text-xs text-muted-foreground">{logs.length}개</span>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {displayLogs.map((log) => {
            const actionConfig = actionLabels[log.action] || {
              label: log.action,
              color: 'bg-muted text-muted-foreground',
            };

            return (
              <div
                key={log.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={actionConfig.color}
                  >
                    {actionConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {log.user.name || log.user.email}
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {log.metadata.reason && (
                      <p>사유: {log.metadata.reason}</p>
                    )}
                    {log.metadata.verdict && (
                      <p>판정: {log.metadata.verdict}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {logs.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              더 보기 ({logs.length - 5}개)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
```

---

## 체크리스트

### 4.1 PDF 렌더링
- [ ] `react-pdf` 패키지 설치
- [ ] `next.config.js` webpack 설정 추가
- [ ] PDF Worker 설정
- [ ] `_components/pdf-viewer.tsx` 구현
- [ ] 텍스트 레이어 하이라이트 유틸리티 구현
- [ ] Dual Viewer에 PDF 뷰어 통합 (PDF 파일인 경우)

### 4.2 스크롤 동기화
- [ ] `_components/use-scroll-sync.ts` 훅 구현
- [ ] `_components/scroll-sync-toggle.tsx` 토글 UI 구현
- [ ] Dual Viewer에 스크롤 동기화 적용
- [ ] 비율 기반 / 매핑 기반 동기화 테스트

### 4.3 민감정보 마스킹
- [ ] `lib/knowledge-pages/verification/masking.ts` 구현
- [ ] 전화번호, 이메일, 주민번호, 카드번호, 계좌번호 패턴 테스트
- [ ] `_components/masking-badge.tsx` 구현
- [ ] 마스킹 해제 권한 체크 로직 추가

### 4.4 감사 로그
- [ ] `drizzle/schema.ts`에 `validationAuditLogs` 테이블 추가
- [ ] 마이그레이션 실행 (`pnpm db:generate && pnpm db:migrate`)
- [ ] `lib/knowledge-pages/verification/audit-logger.ts` 구현
- [ ] `_components/audit-log-panel.tsx` 구현
- [ ] Server Actions에 감사 로그 기록 통합

### 통합
- [ ] Dual Viewer 페이지에 모든 고급 기능 통합
- [ ] PDF 원본 문서 렌더링 테스트
- [ ] 스크롤 동기화 동작 확인
- [ ] 민감정보 마스킹 확인
- [ ] 감사 로그 기록 확인

---

## 다음 단계

Phase 5에서 통합 테스트 및 최종 검증을 진행합니다.

---

*문서 작성일: 2026-01-11*
*상태: 구현 대기*
