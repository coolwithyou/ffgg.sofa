'use client';

import { useWidgetConfig } from '../../hooks/use-console-state';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  MessageCircle,
  HelpCircle,
  Headphones,
  ArrowDownRight,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpLeft,
} from 'lucide-react';
import type { WidgetConfig } from '@/lib/widget/types';

/**
 * 위치 옵션
 */
const POSITION_OPTIONS: {
  value: WidgetConfig['position'];
  label: string;
  icon: typeof ArrowDownRight;
}[] = [
  { value: 'bottom-right', label: '우하단', icon: ArrowDownRight },
  { value: 'bottom-left', label: '좌하단', icon: ArrowDownLeft },
  { value: 'top-right', label: '우상단', icon: ArrowUpRight },
  { value: 'top-left', label: '좌상단', icon: ArrowUpLeft },
];

/**
 * 버튼 아이콘 옵션
 */
const ICON_OPTIONS: {
  value: NonNullable<WidgetConfig['buttonIcon']>;
  label: string;
  icon: typeof MessageCircle;
}[] = [
  { value: 'chat', label: '채팅', icon: MessageCircle },
  { value: 'question', label: '질문', icon: HelpCircle },
  { value: 'support', label: '지원', icon: Headphones },
];

/**
 * 위젯 위치 설정
 *
 * - 위젯 위치 (4방향 RadioGroup)
 * - 버튼 아이콘 (chat/question/support)
 */
export function WidgetPositionSettings() {
  const { widgetConfig, updateWidgetConfig } = useWidgetConfig();
  const { position, buttonIcon } = widgetConfig;

  return (
    <div className="space-y-6 pb-4">
      {/* 위젯 위치 */}
      <div className="space-y-3">
        <Label>위젯 위치</Label>
        <RadioGroup
          value={position}
          onValueChange={(value) =>
            updateWidgetConfig({ position: value as WidgetConfig['position'] })
          }
          className="grid grid-cols-2 gap-2"
        >
          {POSITION_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div key={option.value}>
                <RadioGroupItem
                  value={option.value}
                  id={`position-${option.value}`}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`position-${option.value}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </label>
              </div>
            );
          })}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          사이트에서 위젯이 표시될 위치를 선택합니다
        </p>
      </div>

      {/* 버튼 아이콘 */}
      <div className="space-y-3">
        <Label>버튼 아이콘</Label>
        <RadioGroup
          value={buttonIcon ?? 'chat'}
          onValueChange={(value) =>
            updateWidgetConfig({
              buttonIcon: value as WidgetConfig['buttonIcon'],
            })
          }
          className="flex gap-2"
        >
          {ICON_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div key={option.value} className="flex-1">
                <RadioGroupItem
                  value={option.value}
                  id={`icon-${option.value}`}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`icon-${option.value}`}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                >
                  <Icon className="h-5 w-5" />
                  {option.label}
                </label>
              </div>
            );
          })}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          플로팅 버튼에 표시될 아이콘을 선택합니다
        </p>
      </div>
    </div>
  );
}
