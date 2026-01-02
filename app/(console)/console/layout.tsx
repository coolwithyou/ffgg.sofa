import type { ReactNode } from 'react';
import { ConsoleProvider } from './hooks/use-console-state';
import { ToastProvider } from '@/components/ui/toast';

export const metadata = {
  title: 'Console Editor - SOFA',
  description: '쉽고 직관적인 챗봇 페이지 에디터',
};

interface ConsoleLayoutProps {
  children: ReactNode;
}

export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <ToastProvider>
      <ConsoleProvider>
        <div className="h-screen w-screen overflow-hidden bg-background">
          {children}
        </div>
      </ConsoleProvider>
    </ToastProvider>
  );
}
