'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * 미저장 변경사항 경고 훅 옵션
 */
interface UseUnsavedChangesWarningOptions {
  /** 변경사항이 있는지 여부 */
  hasChanges: boolean;
  /** 경고 메시지 (브라우저 기본 메시지가 표시될 수 있음) */
  message?: string;
  /** 경고 다이얼로그 표시 전 호출되는 콜백 (커스텀 다이얼로그용) */
  onNavigationAttempt?: (targetPath: string) => Promise<boolean>;
  /** 활성화 여부 */
  enabled?: boolean;
}

/**
 * 미저장 변경사항 경고 훅
 *
 * 페이지 이탈 시 미저장 변경사항이 있으면 경고를 표시합니다.
 *
 * 동작 방식:
 * 1. 브라우저 이탈 (탭 닫기, 새로고침): beforeunload 이벤트로 브라우저 기본 경고 표시
 * 2. 앱 내 라우팅: onNavigationAttempt 콜백으로 커스텀 다이얼로그 표시
 *
 * @example
 * ```tsx
 * const { hasChanges, saveNow } = useAutoSaveContext();
 * const { confirm } = useAlertDialog();
 *
 * useUnsavedChangesWarning({
 *   hasChanges,
 *   onNavigationAttempt: async (targetPath) => {
 *     const confirmed = await confirm({
 *       title: '변경사항이 저장되지 않았습니다',
 *       message: '저장하지 않고 나가시겠습니까?',
 *       confirmText: '나가기',
 *       cancelText: '취소',
 *     });
 *     return confirmed;
 *   },
 * });
 * ```
 */
export function useUnsavedChangesWarning({
  hasChanges,
  message = '변경사항이 저장되지 않았습니다. 정말 나가시겠습니까?',
  onNavigationAttempt,
  enabled = true,
}: UseUnsavedChangesWarningOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const isNavigatingRef = useRef(false);
  const targetPathRef = useRef<string | null>(null);

  // beforeunload 이벤트 핸들러 (브라우저 이탈)
  useEffect(() => {
    if (!enabled || !hasChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 브라우저 기본 경고 메시지 표시
      event.preventDefault();
      // Chrome requires returnValue to be set
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, hasChanges, message]);

  // 링크 클릭 인터셉트 (앱 내 라우팅)
  useEffect(() => {
    if (!enabled || !hasChanges || !onNavigationAttempt) return;

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // 외부 링크는 beforeunload가 처리
      if (href.startsWith('http') || href.startsWith('//')) return;

      // 같은 페이지 앵커 링크는 무시
      if (href.startsWith('#')) return;

      // 현재 페이지와 같은 경로면 무시
      if (href === pathname) return;

      // 이미 네비게이션 중이면 무시
      if (isNavigatingRef.current) return;

      // 기본 동작 방지
      event.preventDefault();
      event.stopPropagation();

      isNavigatingRef.current = true;
      targetPathRef.current = href;

      try {
        const shouldNavigate = await onNavigationAttempt(href);
        if (shouldNavigate) {
          // 네비게이션 허용
          router.push(href);
        }
      } finally {
        isNavigatingRef.current = false;
        targetPathRef.current = null;
      }
    };

    // 캡처 단계에서 이벤트 처리 (다른 핸들러보다 먼저)
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [enabled, hasChanges, onNavigationAttempt, pathname, router]);

  // 프로그래매틱 라우팅을 위한 안전한 네비게이션 함수
  const safeNavigate = useCallback(
    async (targetPath: string) => {
      if (!enabled || !hasChanges) {
        router.push(targetPath);
        return true;
      }

      if (onNavigationAttempt) {
        const shouldNavigate = await onNavigationAttempt(targetPath);
        if (shouldNavigate) {
          router.push(targetPath);
          return true;
        }
        return false;
      }

      // onNavigationAttempt가 없으면 기본 confirm 사용
      const confirmed = window.confirm(message);
      if (confirmed) {
        router.push(targetPath);
        return true;
      }
      return false;
    },
    [enabled, hasChanges, message, onNavigationAttempt, router]
  );

  return {
    /** 안전한 네비게이션 함수 (커스텀 경고 표시) */
    safeNavigate,
    /** 현재 네비게이션 시도 중인지 여부 */
    isNavigating: isNavigatingRef.current,
  };
}
