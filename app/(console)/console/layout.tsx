import type { ReactNode } from 'react';
import { ConsoleProvider } from './hooks/use-console-state';
import { ToastProvider } from '@/components/ui/toast';
import { ConsoleShell } from './components/console-shell';

export const metadata = {
  title: 'Console - SOFA',
  description: '쉽고 직관적인 챗봇 관리 콘솔',
};

interface ConsoleLayoutProps {
  children: ReactNode;
}

/**
 * Console 레이아웃
 *
 * 2-레벨 네비게이션 구조:
 * - Primary Nav (80px): 주요 메뉴 (Dashboard, Knowledge, Appearance, Settings)
 * - Secondary Panel (240px): 컨텍스트별 서브메뉴
 * - Main Content: 페이지 컨텐츠
 */
export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <ToastProvider>
      <ConsoleProvider>
        <ConsoleShell>{children}</ConsoleShell>
      </ConsoleProvider>
    </ToastProvider>
  );
}
