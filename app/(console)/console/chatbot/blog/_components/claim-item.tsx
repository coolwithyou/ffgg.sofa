// app/(console)/console/chatbot/blog/_components/claim-item.tsx

import { Button } from '@/components/ui/button';
import { VerdictBadge } from './verdict-badge';
import { RiskBadge } from './risk-badge';
import type { claims } from '@/drizzle/schema';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

type Claim = typeof claims.$inferSelect;

interface ClaimItemProps {
  claim: Claim;
  isSelected: boolean;
  onSelect: () => void;
  onVerdictChange: (
    claimId: string,
    verdict: 'approved' | 'rejected' | 'modified',
    note?: string
  ) => void;
}

const claimTypeLabels: Record<string, string> = {
  numeric: '숫자',
  contact: '연락처',
  date: '날짜',
  text: '텍스트',
  list: '목록',
  table: '테이블',
};

export function ClaimItem({
  claim,
  isSelected,
  onSelect,
  onVerdictChange,
}: ClaimItemProps) {
  const isHighRisk = claim.riskLevel === 'high';
  const needsReview = isHighRisk && !claim.humanVerdict;

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        isHighRisk && !claim.humanVerdict && 'border-l-4 border-l-destructive'
      )}
      onClick={onSelect}
    >
      {/* 헤더: 타입 + 위험도 + 판정 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {claimTypeLabels[claim.claimType] || claim.claimType}
        </span>
        <RiskBadge level={claim.riskLevel} />
        <VerdictBadge verdict={claim.verdict} />
        {claim.humanVerdict && (
          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs font-medium text-green-500">
            검토 완료
          </span>
        )}
      </div>

      {/* 본문 */}
      <p className="line-clamp-2 text-sm text-foreground">{claim.claimText}</p>

      {/* 검증 상세 */}
      {claim.verificationDetail && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {claim.verificationDetail}
        </p>
      )}

      {/* 사용자 액션 (High Risk만 필수) */}
      {needsReview && (
        <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onVerdictChange(claim.id, 'approved')}
          >
            <Check className="mr-1 h-3 w-3" />
            확인
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onVerdictChange(claim.id, 'rejected')}
          >
            <X className="mr-1 h-3 w-3" />
            거부
          </Button>
        </div>
      )}

      {/* 이미 검토된 경우 */}
      {claim.humanVerdict && claim.humanNote && (
        <p className="mt-2 rounded bg-muted p-2 text-xs text-muted-foreground">
          메모: {claim.humanNote}
        </p>
      )}
    </div>
  );
}
