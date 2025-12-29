'use client';

/**
 * 테마 프로바이더 컴포넌트
 * next-themes를 사용한 다크/라이트 모드 지원
 */

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
