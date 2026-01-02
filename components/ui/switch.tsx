'use client';

/**
 * Switch 컴포넌트
 * shadcn/ui 스타일의 토글 스위치 (Radix UI 기반)
 */

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

// 크기별 스타일 정의
const sizeStyles = {
  sm: {
    root: 'h-5 w-9',
    thumb: 'h-4 w-4 data-[state=checked]:translate-x-4',
  },
  md: {
    root: 'h-6 w-11',
    thumb: 'h-5 w-5 data-[state=checked]:translate-x-5',
  },
  lg: {
    root: 'h-[30px] w-[52px]',
    thumb: 'h-[22px] w-[22px] data-[state=checked]:translate-x-[22px]',
  },
};

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  /** 스위치 크기 */
  size?: 'sm' | 'md' | 'lg';
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'md', ...props }, ref) => {
  const styles = sizeStyles[size];

  return (
    <SwitchPrimitives.Root
      className={`
        peer inline-flex shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent shadow-sm transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
        disabled:cursor-not-allowed disabled:opacity-50
        data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted
        ${styles.root}
        ${className || ''}
      `}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={`
          pointer-events-none block rounded-full bg-background shadow-lg ring-0
          transition-transform data-[state=unchecked]:translate-x-0.5
          ${styles.thumb}
        `}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
