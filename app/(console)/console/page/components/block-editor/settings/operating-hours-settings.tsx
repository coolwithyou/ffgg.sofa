'use client';

/**
 * 운영 시간 블록 설정 컴포넌트
 *
 * OperatingHoursBlock의 설정을 편집합니다:
 * - 요일별 운영 시간 설정
 * - 타임존 설정
 * - 현재 상태 표시 옵션
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  OperatingHoursBlock,
  OperatingHoursScheduleItem,
  DayOfWeek,
} from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

// 요일 목록
const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'mon', label: '월요일' },
  { value: 'tue', label: '화요일' },
  { value: 'wed', label: '수요일' },
  { value: 'thu', label: '목요일' },
  { value: 'fri', label: '금요일' },
  { value: 'sat', label: '토요일' },
  { value: 'sun', label: '일요일' },
];

// 인기 타임존 목록
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Seoul', label: '서울 (KST)' },
  { value: 'Asia/Tokyo', label: '도쿄 (JST)' },
  { value: 'America/New_York', label: '뉴욕 (EST)' },
  { value: 'America/Los_Angeles', label: '로스앤젤레스 (PST)' },
  { value: 'Europe/London', label: '런던 (GMT)' },
  { value: 'Europe/Paris', label: '파리 (CET)' },
  { value: 'UTC', label: 'UTC' },
];

export function OperatingHoursBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<OperatingHoursBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<OperatingHoursBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<OperatingHoursBlock>);
  };

  /**
   * 특정 요일 스케줄 찾기
   */
  const findDaySchedule = (day: DayOfWeek): OperatingHoursScheduleItem | undefined => {
    return config.schedule.find((s) => s.day === day);
  };

  /**
   * 요일 스케줄 업데이트
   */
  const updateDaySchedule = (
    day: DayOfWeek,
    updates: Partial<Omit<OperatingHoursScheduleItem, 'day'>>
  ) => {
    const existing = findDaySchedule(day);

    if (existing) {
      // 기존 스케줄 업데이트
      updateConfig({
        schedule: config.schedule.map((s) =>
          s.day === day ? { ...s, ...updates } : s
        ),
      });
    } else {
      // 새 스케줄 추가
      const newSchedule: OperatingHoursScheduleItem = {
        day,
        open: '09:00',
        close: '18:00',
        closed: false,
        ...updates,
      };
      updateConfig({
        schedule: [...config.schedule, newSchedule],
      });
    }
  };

  /**
   * 요일 활성화/비활성화
   */
  const toggleDay = (day: DayOfWeek, enabled: boolean) => {
    if (enabled) {
      // 요일 추가 (기본 시간으로)
      const newSchedule: OperatingHoursScheduleItem = {
        day,
        open: '09:00',
        close: '18:00',
        closed: false,
      };
      updateConfig({
        schedule: [...config.schedule.filter((s) => s.day !== day), newSchedule],
      });
    } else {
      // 요일 제거
      updateConfig({
        schedule: config.schedule.filter((s) => s.day !== day),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 요일별 스케줄 */}
      <div className="space-y-3">
        <Label>운영 시간</Label>
        <div className="space-y-2">
          {DAYS_OF_WEEK.map(({ value: day, label }) => {
            const schedule = findDaySchedule(day);
            const isEnabled = !!schedule;
            const isClosed = schedule?.closed ?? false;

            return (
              <div
                key={day}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                {/* 요일 활성화 토글 */}
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleDay(day, checked)}
                />

                {/* 요일 라벨 */}
                <span className="w-16 text-sm font-medium">{label}</span>

                {isEnabled && !isClosed ? (
                  <>
                    {/* 시작 시간 */}
                    <Input
                      type="time"
                      value={schedule?.open ?? '09:00'}
                      onChange={(e) =>
                        updateDaySchedule(day, { open: e.target.value })
                      }
                      className="w-24"
                    />
                    <span className="text-muted-foreground">~</span>
                    {/* 종료 시간 */}
                    <Input
                      type="time"
                      value={schedule?.close ?? '18:00'}
                      onChange={(e) =>
                        updateDaySchedule(day, { close: e.target.value })
                      }
                      className="w-24"
                    />
                    {/* 휴무 토글 */}
                    <button
                      type="button"
                      className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => updateDaySchedule(day, { closed: true })}
                    >
                      휴무로 변경
                    </button>
                  </>
                ) : isEnabled && isClosed ? (
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-sm text-muted-foreground">휴무</span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => updateDaySchedule(day, { closed: false })}
                    >
                      운영으로 변경
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">미설정</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 타임존 */}
      <div className="space-y-2">
        <Label htmlFor="timezone">타임존</Label>
        <Select
          value={config.timezone}
          onValueChange={(value) => updateConfig({ timezone: value })}
        >
          <SelectTrigger id="timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 현재 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="show-status" className="cursor-pointer">
            현재 상태 표시
          </Label>
          <p className="text-xs text-muted-foreground">
            &quot;운영 중&quot; 또는 &quot;운영 종료&quot; 배지를 표시합니다.
          </p>
        </div>
        <Switch
          id="show-status"
          checked={config.showCurrentStatus}
          onCheckedChange={(checked) =>
            updateConfig({ showCurrentStatus: checked })
          }
        />
      </div>
    </div>
  );
}
