'use client';

/**
 * 관리자 포털 클라이언트 프로바이더
 * AlertDialog, Toast 등 클라이언트 전용 컨텍스트 제공
 */

import { ReactNode } from 'react';
import { AlertDialogProvider } from '@/components/ui/alert-dialog';
import { ToastProvider } from '@/components/ui/toast';

interface AdminProvidersProps {
  children: ReactNode;
}

export function AdminProviders({ children }: AdminProvidersProps) {
  return (
    <AlertDialogProvider>
      <ToastProvider>{children}</ToastProvider>
    </AlertDialogProvider>
  );
}
