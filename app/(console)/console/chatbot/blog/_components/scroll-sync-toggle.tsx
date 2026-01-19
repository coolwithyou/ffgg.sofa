// app/(console)/console/chatbot/blog/_components/scroll-sync-toggle.tsx
'use client';

/**
 * 스크롤 동기화 토글 컴포넌트
 *
 * 원본 PDF와 재구성 문서 간 스크롤 동기화를 켜고 끌 수 있습니다.
 * 동기화 모드도 선택할 수 있습니다.
 */

import { useState } from 'react';
import { Link2, Link2Off, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type SyncMode = 'ratio' | 'mapping' | 'hybrid';

interface ScrollSyncToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  mode?: SyncMode;
  onModeChange?: (mode: SyncMode) => void;
  hasMappings?: boolean;
  className?: string;
}

const modeLabels: Record<SyncMode, { label: string; description: string }> = {
  ratio: {
    label: '비율 기반',
    description: '스크롤 위치를 퍼센트로 동기화 (단순)',
  },
  mapping: {
    label: '매핑 기반',
    description: '텍스트 위치 매핑을 사용 (정확)',
  },
  hybrid: {
    label: '하이브리드',
    description: '매핑이 있으면 매핑, 없으면 비율 사용',
  },
};

export function ScrollSyncToggle({
  enabled,
  onToggle,
  mode = 'hybrid',
  onModeChange,
  hasMappings = false,
  className = '',
}: ScrollSyncToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* 메인 토글 버튼 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(!enabled)}
            className="gap-2"
          >
            {enabled ? (
              <Link2 className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">스크롤 동기화</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {enabled
            ? '스크롤 동기화가 활성화됨'
            : '클릭하여 스크롤 동기화 활성화'}
        </TooltipContent>
      </Tooltip>

      {/* 모드 선택 드롭다운 */}
      {onModeChange && (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="px-1.5"
              disabled={!enabled}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>동기화 모드</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(modeLabels) as SyncMode[]).map((modeKey) => {
              const { label, description } = modeLabels[modeKey];
              const isDisabled =
                modeKey === 'mapping' && !hasMappings;
              const isSelected = mode === modeKey;

              return (
                <DropdownMenuItem
                  key={modeKey}
                  onClick={() => onModeChange(modeKey)}
                  disabled={isDisabled}
                  className={isSelected ? 'bg-primary/10' : ''}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {label}
                      {isSelected && ' ✓'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {description}
                      {isDisabled && ' (매핑 데이터 없음)'}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default ScrollSyncToggle;
