// app/(console)/console/chatbot/blog/_components/claim-panel.tsx

import { ClaimItem } from './claim-item';
import type { claims } from '@/drizzle/schema';

type Claim = typeof claims.$inferSelect;

interface ClaimPanelProps {
  claims: Claim[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVerdictChange: (
    claimId: string,
    verdict: 'approved' | 'rejected' | 'modified',
    note?: string
  ) => void;
}

export function ClaimPanel({
  claims,
  selectedId,
  onSelect,
  onVerdictChange,
}: ClaimPanelProps) {
  if (claims.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        해당 조건의 항목이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {claims.map((claim) => (
        <ClaimItem
          key={claim.id}
          claim={claim}
          isSelected={claim.id === selectedId}
          onSelect={() => onSelect(claim.id === selectedId ? null : claim.id)}
          onVerdictChange={onVerdictChange}
        />
      ))}
    </div>
  );
}
