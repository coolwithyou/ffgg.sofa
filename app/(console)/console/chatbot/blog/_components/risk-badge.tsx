// app/(console)/console/chatbot/blog/_components/risk-badge.tsx

import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface RiskBadgeProps {
  level: string;
  className?: string;
}

const riskConfig = {
  high: {
    label: '고위험',
    color: 'bg-destructive/10 text-destructive',
    icon: AlertTriangle,
  },
  medium: {
    label: '중위험',
    color: 'bg-yellow-500/10 text-yellow-500',
    icon: AlertCircle,
  },
  low: {
    label: '저위험',
    color: 'bg-muted text-muted-foreground',
    icon: Info,
  },
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = riskConfig[level as keyof typeof riskConfig] || riskConfig.low;
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
