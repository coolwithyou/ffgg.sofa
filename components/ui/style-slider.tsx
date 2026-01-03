'use client';

import { cn } from '@/lib/utils';
import { Label } from './label';
import { Slider } from './slider';

interface StyleSliderProps {
  /** 라벨 텍스트 */
  label: string;
  /** 현재 값 */
  value: number;
  /** 값 변경 콜백 */
  onChange: (value: number) => void;
  /** 최소값 */
  min: number;
  /** 최대값 */
  max: number;
  /** 단계 (기본 1) */
  step?: number;
  /** 표시 단위 (기본 'px') */
  unit?: string;
  /** 기본값 (리셋 버튼용) */
  defaultValue?: number;
  /** 설명 텍스트 */
  description?: string;
  /** 클래스명 */
  className?: string;
}

/**
 * 스타일 슬라이더 컴포넌트
 *
 * - 패딩, 마진, border-radius, 그림자 등 수치 조절에 공통 사용
 * - 현재 값과 단위를 표시
 * - 기본값 리셋 기능 제공
 */
export function StyleSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'px',
  defaultValue,
  description,
  className,
}: StyleSliderProps) {
  const showReset = defaultValue !== undefined && value !== defaultValue;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <span className="min-w-[3rem] text-right text-sm font-medium tabular-nums text-muted-foreground">
            {value}
            {unit}
          </span>
          {showReset && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="text-xs text-primary hover:underline"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="py-1"
      />
    </div>
  );
}
