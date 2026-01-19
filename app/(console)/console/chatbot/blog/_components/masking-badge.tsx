// app/(console)/console/chatbot/blog/_components/masking-badge.tsx
'use client';

/**
 * 마스킹 배지 컴포넌트
 *
 * 마스킹된 민감정보의 개수와 유형을 표시합니다.
 * 클릭하면 마스킹 상세 정보를 볼 수 있습니다.
 */

import { useState } from 'react';
import {
  Shield,
  ShieldOff,
  Phone,
  Mail,
  CreditCard,
  User,
  Banknote,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MaskingEntry } from '@/lib/knowledge-pages/verification/masking';

interface MaskingBadgeProps {
  maskings: MaskingEntry[];
  isRevealed: boolean;
  onToggleReveal?: () => void;
  canReveal?: boolean;
  className?: string;
}

const typeIcons: Record<MaskingEntry['type'], typeof Phone> = {
  phone: Phone,
  email: Mail,
  rrn: User,
  card: CreditCard,
  account: Banknote,
};

const typeLabels: Record<MaskingEntry['type'], string> = {
  phone: '전화번호',
  email: '이메일',
  rrn: '주민등록번호',
  card: '카드번호',
  account: '계좌번호',
};

const typeColors: Record<MaskingEntry['type'], string> = {
  phone: 'bg-blue-500/10 text-blue-500',
  email: 'bg-green-500/10 text-green-500',
  rrn: 'bg-red-500/10 text-red-500',
  card: 'bg-purple-500/10 text-purple-500',
  account: 'bg-orange-500/10 text-orange-500',
};

export function MaskingBadge({
  maskings,
  isRevealed,
  onToggleReveal,
  canReveal = false,
  className = '',
}: MaskingBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 유형별 그룹핑
  const groupedMaskings = maskings.reduce(
    (acc, masking) => {
      acc[masking.type] = (acc[masking.type] || 0) + 1;
      return acc;
    },
    {} as Record<MaskingEntry['type'], number>
  );

  const totalCount = maskings.length;

  if (totalCount === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1.5 text-muted-foreground ${className}`}
          >
            <Shield className="h-3.5 w-3.5" />
            민감정보 없음
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          이 문서에서 민감정보가 탐지되지 않았습니다
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 ${className}`}
        >
          {isRevealed ? (
            <ShieldOff className="h-4 w-4 text-destructive" />
          ) : (
            <Shield className="h-4 w-4 text-primary" />
          )}
          <span>
            민감정보 <strong>{totalCount}</strong>건
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">마스킹된 민감정보</h4>
            {canReveal && onToggleReveal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onToggleReveal();
                  setIsOpen(false);
                }}
                className="gap-1.5 h-7 text-xs"
              >
                {isRevealed ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    숨기기
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    원본 보기
                  </>
                )}
              </Button>
            )}
          </div>

          {/* 유형별 요약 */}
          <div className="space-y-2">
            {(Object.entries(groupedMaskings) as [MaskingEntry['type'], number][]).map(
              ([type, count]) => {
                const Icon = typeIcons[type];
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded ${typeColors[type]}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm">{typeLabels[type]}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {count}건
                    </Badge>
                  </div>
                );
              }
            )}
          </div>

          {/* 상세 목록 (선택적) */}
          {maskings.length > 0 && maskings.length <= 5 && (
            <>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">상세 목록</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {maskings.map((masking, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50"
                    >
                      <span className="text-muted-foreground">
                        {typeLabels[masking.type]}:
                      </span>
                      <code className="font-mono text-foreground">
                        {isRevealed ? masking.original : masking.masked}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 경고 메시지 */}
          {isRevealed && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">
                ⚠️ 민감정보가 노출되어 있습니다. 작업 완료 후 다시 마스킹하세요.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MaskingBadge;
