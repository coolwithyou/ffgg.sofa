'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface DeviceFrameProps {
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
}

/**
 * 디바이스 프레임 설정
 *
 * 주의: 물리적 디바이스 시뮬레이션이므로 테마 색상을 사용하지 않음
 */
const DEVICE_CONFIG = {
  width: 375,
  height: 667,
  padding: 12,
  borderRadius: {
    outer: 40,
    inner: 28,
  },
  colors: {
    frame: '#1f2937', // 디바이스 프레임 (고정)
    homeIndicator: '#4b5563', // 홈 인디케이터 (고정)
  },
} as const;

/**
 * iPhone 스타일 디바이스 프레임
 *
 * 디자인 결정:
 * - 375x667 (iPhone SE 기준) - 가장 보편적인 모바일 뷰포트
 * - 둥근 테두리와 노치로 실제 디바이스 느낌 제공
 * - 그림자로 깊이감 추가
 *
 * 색상 참고:
 * - 프레임 색상은 물리적 디바이스를 시뮬레이션하므로
 *   시맨틱 토큰 대신 고정값 사용 (DEVICE_CONFIG 참조)
 */
export function DeviceFrame({
  children,
  className,
  isLoading,
}: DeviceFrameProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden shadow-2xl',
        className
      )}
      style={{
        width: DEVICE_CONFIG.width,
        height: DEVICE_CONFIG.height,
        padding: DEVICE_CONFIG.padding,
        borderRadius: DEVICE_CONFIG.borderRadius.outer,
        backgroundColor: DEVICE_CONFIG.colors.frame,
      }}
    >
      {/* 노치 (상단 센서 영역) */}
      <div
        className="absolute left-1/2 top-3 z-10 h-6 w-32 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: DEVICE_CONFIG.colors.frame }}
      />

      {/* 내부 스크린 - bg-card로 테마 적응 */}
      <div
        className="relative flex-1 overflow-hidden bg-card"
        style={{ borderRadius: DEVICE_CONFIG.borderRadius.inner }}
      >
        {/* 상단 상태바 공간 */}
        <div className="h-11 w-full bg-inherit" />

        {/* 콘텐츠 영역 */}
        <div className="h-[calc(100%-44px)] overflow-y-auto">
          {isLoading ? <DeviceFrameSkeleton /> : children}
        </div>
      </div>

      {/* 하단 홈 인디케이터 */}
      <div
        className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: DEVICE_CONFIG.colors.homeIndicator }}
      />
    </div>
  );
}

/**
 * 디바이스 프레임 내부 로딩 스켈레톤
 */
function DeviceFrameSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 헤더 스켈레톤 */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* 채팅 영역 스켈레톤 */}
      <div className="flex-1 space-y-3">
        <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      </div>

      {/* 입력 영역 스켈레톤 */}
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}
