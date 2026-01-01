'use client';

/**
 * 포털 클라이언트 프로바이더
 * AlertDialog 등 클라이언트 전용 컨텍스트 제공
 */

import { ReactNode } from 'react';
import { AlertDialogProvider } from '@/components/ui/alert-dialog';

interface PortalProvidersProps {
  children: ReactNode;
}

export function PortalProviders({ children }: PortalProvidersProps) {
  return <AlertDialogProvider>{children}</AlertDialogProvider>;
}
