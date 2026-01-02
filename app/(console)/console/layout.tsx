import type { ReactNode } from 'react';
import { ConsoleProvider } from './hooks/use-console-state';
import { ToastProvider } from '@/components/ui/toast';
import { Toaster } from '@/components/ui/sonner';
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
 * shadcn/ui Sidebar 기반 네비게이션 구조:
 * - AppSidebar (240px): 로고 + 챗봇 선택기 + 메인 메뉴
 * - Main Content: 페이지 컨텐츠
 */
export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <ToastProvider>
      <ConsoleProvider>
        <ConsoleShell>{children}</ConsoleShell>
        <Toaster position="bottom-right" />
      </ConsoleProvider>
    </ToastProvider>
  );
}
