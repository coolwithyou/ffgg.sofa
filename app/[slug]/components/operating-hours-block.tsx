'use client';

/**
 * 운영 시간 블록 컴포넌트
 *
 * 요일별 운영 시간을 표시합니다.
 * - 현재 운영 상태 자동 표시
 * - 타임존 지원
 */

import { useMemo } from 'react';
import { Clock, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperatingHoursScheduleItem, DayOfWeek } from '@/lib/public-page/block-types';

interface OperatingHoursBlockProps {
  schedule: OperatingHoursScheduleItem[];
  timezone: string;
  showCurrentStatus: boolean;
}

// 요일 표시 이름
const DAY_NAMES: Record<DayOfWeek, string> = {
  mon: '월요일',
  tue: '화요일',
  wed: '수요일',
  thu: '목요일',
  fri: '금요일',
  sat: '토요일',
  sun: '일요일',
};

// 요일 짧은 이름
const DAY_SHORT_NAMES: Record<DayOfWeek, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

// JavaScript 요일을 DayOfWeek로 변환 (0=일, 1=월, ...)
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function OperatingHoursBlock({
  schedule,
  timezone,
  showCurrentStatus,
}: OperatingHoursBlockProps) {
  // 현재 운영 상태 계산
  const currentStatus = useMemo(() => {
    if (!showCurrentStatus) return null;

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const weekday = parts.find((p) => p.type === 'weekday')?.value.toLowerCase();
      const hour = parts.find((p) => p.type === 'hour')?.value;
      const minute = parts.find((p) => p.type === 'minute')?.value;

      if (!weekday || !hour || !minute) return null;

      // 요일 매핑
      const dayMap: Record<string, DayOfWeek> = {
        mon: 'mon',
        tue: 'tue',
        wed: 'wed',
        thu: 'thu',
        fri: 'fri',
        sat: 'sat',
        sun: 'sun',
      };

      const currentDay = dayMap[weekday];
      if (!currentDay) return null;

      const todaySchedule = schedule.find((s) => s.day === currentDay);
      if (!todaySchedule || todaySchedule.closed) {
        return { isOpen: false, nextOpen: null };
      }

      const currentTime = `${hour}:${minute}`;
      const isOpen = currentTime >= todaySchedule.open && currentTime < todaySchedule.close;

      return { isOpen, closeTime: todaySchedule.close };
    } catch {
      return null;
    }
  }, [schedule, timezone, showCurrentStatus]);

  // 스케줄이 없으면 플레이스홀더 표시
  if (schedule.length === 0) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <span className="text-muted-foreground">운영 시간을 설정하세요</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">운영 시간</span>
        </div>

        {/* 현재 상태 배지 */}
        {showCurrentStatus && currentStatus && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              currentStatus.isOpen
                ? 'bg-green-500/10 text-green-500'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStatus.isOpen ? (
              <>
                <Check className="h-3 w-3" />
                운영 중
              </>
            ) : (
              <>
                <X className="h-3 w-3" />
                운영 종료
              </>
            )}
          </div>
        )}
      </div>

      {/* 스케줄 목록 */}
      <div className="divide-y divide-border">
        {schedule.map((item) => (
          <div
            key={item.day}
            className={cn(
              'flex items-center justify-between px-4 py-3',
              item.closed && 'bg-muted/20'
            )}
          >
            <span className="font-medium text-foreground">
              {DAY_NAMES[item.day]}
            </span>
            {item.closed ? (
              <span className="text-sm text-muted-foreground">휴무</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {item.open} - {item.close}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 타임존 표시 */}
      <div className="border-t border-border bg-muted/30 px-4 py-2">
        <span className="text-xs text-muted-foreground">
          기준: {timezone}
        </span>
      </div>
    </div>
  );
}
