'use client';

/**
 * 출처 표시 접이식 컴포넌트
 *
 * 채팅 답변 하단에 참조된 문서 출처를 접이식으로 표시
 * 클릭하면 펼쳐져 상세 내용 확인 가능
 */

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

/**
 * 출처 정보 타입
 */
export interface Source {
  /** 문서 ID */
  documentId?: string;
  /** 청크 ID */
  chunkId?: string;
  /** 문서 제목 */
  title?: string;
  /** 내용 스니펫 */
  content?: string;
  /** 관련도 점수 (0-1) */
  relevance?: number;
  /** 문서 이름 */
  documentName?: string;
}

interface SourcesCollapsibleProps {
  /** 출처 목록 */
  sources: Source[];
  /** 테마 컬러 */
  primaryColor?: string;
  /** 기본 펼침 상태 */
  defaultOpen?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
}

/**
 * 출처 표시 접이식 컴포넌트
 */
export function SourcesCollapsible({
  sources,
  primaryColor = '#3b82f6',
  defaultOpen = false,
  compact = false,
}: SourcesCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!sources || sources.length === 0) {
    return null;
  }

  const padding = compact ? 'p-2' : 'p-3';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <div className="flex items-center gap-2">
          <FileText className={iconSize} style={{ color: primaryColor }} />
          <span className={textSize}>
            참고한 문서 {sources.length}개
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className={iconSize} />
        ) : (
          <ChevronDown className={iconSize} />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-2">
        {sources.map((source, index) => (
          <SourceCard
            key={source.chunkId || source.documentId || index}
            source={source}
            primaryColor={primaryColor}
            compact={compact}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * 개별 출처 카드
 */
function SourceCard({
  source,
  primaryColor,
  compact,
}: {
  source: Source;
  primaryColor: string;
  compact: boolean;
}) {
  const padding = compact ? 'p-2' : 'p-3';
  const textSize = compact ? 'text-xs' : 'text-sm';

  // 출처 제목 결정 (title > documentName > documentId)
  const title =
    source.title ||
    source.documentName ||
    (source.documentId ? `문서 #${source.documentId.slice(0, 8)}` : '출처');

  // 관련도를 퍼센트로 변환 (0-1 → 0-100)
  const relevancePercent = source.relevance
    ? Math.round(source.relevance * 100)
    : null;

  return (
    <div
      className={`rounded-lg border border-border bg-card ${padding} transition-colors hover:bg-muted/30`}
    >
      {/* 헤더: 제목 + 관련도 */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`font-medium text-foreground ${textSize}`}>
          {title}
        </span>
        {relevancePercent !== null && (
          <RelevanceBadge percent={relevancePercent} color={primaryColor} compact={compact} />
        )}
      </div>

      {/* 내용 스니펫 */}
      {source.content && (
        <p
          className={`line-clamp-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {source.content}
        </p>
      )}
    </div>
  );
}

/**
 * 관련도 배지 (Badge 컴포넌트 대체)
 */
function RelevanceBadge({
  percent,
  color,
  compact,
}: {
  percent: number;
  color: string;
  compact: boolean;
}) {
  // 관련도에 따른 스타일 결정
  const getStyle = () => {
    if (percent >= 80) {
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-600 dark:text-green-400',
        border: 'border-green-500/20',
      };
    }
    if (percent >= 60) {
      return {
        bg: 'bg-primary/10',
        text: 'text-primary',
        border: 'border-primary/20',
      };
    }
    return {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      border: 'border-border',
    };
  };

  const style = getStyle();
  const size = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${size} ${style.bg} ${style.text} ${style.border}`}
    >
      {percent}%
    </span>
  );
}

/**
 * 인라인 출처 표시 (한 줄 버전)
 */
export function InlineSources({
  sources,
  primaryColor = '#3b82f6',
}: {
  sources: Source[];
  primaryColor?: string;
}) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <FileText className="h-3 w-3" style={{ color: primaryColor }} />
      <span>{sources.length}개의 출처에서 참조됨</span>
    </div>
  );
}
