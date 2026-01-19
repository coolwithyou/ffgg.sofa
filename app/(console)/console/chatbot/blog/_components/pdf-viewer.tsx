// app/(console)/console/chatbot/blog/_components/pdf-viewer.tsx
'use client';

/**
 * PDF Viewer 컴포넌트
 *
 * react-pdf를 사용하여 원본 PDF 문서를 렌더링합니다.
 * 텍스트 레이어를 포함하여 하이라이트 기능을 지원합니다.
 */

import { useState, useCallback, useRef, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// PDF.js 워커 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  className?: string;
  onLoadSuccess?: (numPages: number) => void;
  onPageChange?: (pageNumber: number) => void;
  highlights?: {
    pageNumber: number;
    text: string;
  }[];
}

export const PDFViewer = forwardRef<HTMLDivElement, PDFViewerProps>(
  function PDFViewer(
    { url, className = '', onLoadSuccess, onPageChange, highlights = [] },
    ref
  ) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // PDF 로드 성공 핸들러
    const handleLoadSuccess = useCallback(
      ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setIsLoading(false);
        setError(null);
        onLoadSuccess?.(numPages);
      },
      [onLoadSuccess]
    );

    // PDF 로드 에러 핸들러
    const handleLoadError = useCallback((error: Error) => {
      console.error('PDF load error:', error);
      setError('PDF를 불러오는 데 실패했습니다.');
      setIsLoading(false);
    }, []);

    // 페이지 변경
    const goToPage = useCallback(
      (page: number) => {
        const newPage = Math.max(1, Math.min(page, numPages));
        setPageNumber(newPage);
        onPageChange?.(newPage);
      },
      [numPages, onPageChange]
    );

    // 줌 컨트롤
    const zoomIn = useCallback(() => {
      setScale((prev) => Math.min(prev + 0.25, 3.0));
    }, []);

    const zoomOut = useCallback(() => {
      setScale((prev) => Math.max(prev - 0.25, 0.5));
    }, []);

    // 현재 페이지의 하이라이트
    const currentHighlights = highlights.filter(
      (h) => h.pageNumber === pageNumber
    );

    return (
      <div
        ref={ref}
        className={`flex flex-col h-full bg-muted/30 ${className}`}
      >
        {/* 툴바 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[80px] text-center">
              {pageNumber} / {numPages || '-'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={pageNumber >= numPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="h-8 w-8"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="h-8 w-8"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF 뷰어 영역 */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex justify-center p-4"
        >
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          <Document
            file={url}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={null}
            className="relative"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />

            {/* 하이라이트 오버레이 */}
            {currentHighlights.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {currentHighlights.map((highlight, index) => (
                  <HighlightOverlay key={index} text={highlight.text} />
                ))}
              </div>
            )}
          </Document>
        </div>
      </div>
    );
  }
);

/**
 * 하이라이트 오버레이 컴포넌트
 *
 * 실제 구현에서는 텍스트 레이어에서 해당 텍스트를 찾아
 * 정확한 위치에 하이라이트를 표시해야 합니다.
 * 여기서는 placeholder로 구현합니다.
 */
function HighlightOverlay({ text }: { text: string }) {
  // TODO: pdf-highlight.ts의 findTextPositionInPage를 사용하여
  // 실제 텍스트 위치를 찾아 하이라이트 표시
  return (
    <div
      className="absolute bg-yellow-500/30 border border-yellow-500/50 rounded"
      style={{
        // 실제 구현에서는 동적으로 위치 계산
        display: 'none',
      }}
      title={text}
    />
  );
}

export default PDFViewer;
