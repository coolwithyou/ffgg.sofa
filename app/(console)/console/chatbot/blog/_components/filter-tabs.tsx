// app/(console)/console/chatbot/blog/_components/filter-tabs.tsx

import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function FilterTabs({ tabs, activeTab, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted-foreground/20'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
