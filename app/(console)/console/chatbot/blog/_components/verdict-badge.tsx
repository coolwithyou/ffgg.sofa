// app/(console)/console/chatbot/blog/_components/verdict-badge.tsx

import { cn } from '@/lib/utils';
import { Check, X, HelpCircle, Clock } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: string;
  className?: string;
}

const verdictConfig = {
  supported: {
    label: '지지됨',
    color: 'bg-green-500/10 text-green-500',
    icon: Check,
  },
  contradicted: {
    label: '모순',
    color: 'bg-destructive/10 text-destructive',
    icon: X,
  },
  not_found: {
    label: '근거 없음',
    color: 'bg-yellow-500/10 text-yellow-500',
    icon: HelpCircle,
  },
  pending: {
    label: '검증 중',
    color: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
};

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  const config =
    verdictConfig[verdict as keyof typeof verdictConfig] || verdictConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
