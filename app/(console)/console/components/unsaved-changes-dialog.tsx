'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export type UnsavedChangesResult = 'save' | 'discard' | 'cancel';

interface UnsavedChangesDialogOptions {
  title?: string;
  message?: string;
}

interface UnsavedChangesDialogContextType {
  showUnsavedChangesDialog: (
    options?: UnsavedChangesDialogOptions
  ) => Promise<UnsavedChangesResult>;
}

const UnsavedChangesDialogContext = React.createContext<
  UnsavedChangesDialogContextType | undefined
>(undefined);

export function useUnsavedChangesDialog(): UnsavedChangesDialogContextType {
  const context = React.useContext(UnsavedChangesDialogContext);
  if (!context) {
    throw new Error(
      'useUnsavedChangesDialog must be used within UnsavedChangesDialogProvider'
    );
  }
  return context;
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  isLoading: boolean;
  resolve: ((result: UnsavedChangesResult) => void) | null;
}

interface UnsavedChangesDialogProviderProps {
  children: React.ReactNode;
  /** 저장 함수 */
  onSave?: () => Promise<boolean>;
}

/**
 * 미저장 변경사항 경고 다이얼로그 Provider
 *
 * 세 가지 선택지를 제공합니다:
 * - 저장하고 나가기: onSave 호출 후 'save' 반환
 * - 저장 안 함: 'discard' 반환
 * - 취소 (X 버튼, ESC, 외부 클릭): 'cancel' 반환
 */
export function UnsavedChangesDialogProvider({
  children,
  onSave,
}: UnsavedChangesDialogProviderProps) {
  const [dialog, setDialog] = React.useState<DialogState>({
    isOpen: false,
    title: '변경사항이 저장되지 않았습니다',
    message:
      '저장하지 않고 나가면 모든 변경사항을 잃어버립니다. 어떻게 하시겠습니까?',
    isLoading: false,
    resolve: null,
  });

  const resolveRef = React.useRef<((result: UnsavedChangesResult) => void) | null>(null);

  const showUnsavedChangesDialog = React.useCallback(
    (options?: UnsavedChangesDialogOptions): Promise<UnsavedChangesResult> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialog({
          isOpen: true,
          title: options?.title || '변경사항이 저장되지 않았습니다',
          message:
            options?.message ||
            '저장하지 않고 나가면 모든 변경사항을 잃어버립니다. 어떻게 하시겠습니까?',
          isLoading: false,
          resolve,
        });
      });
    },
    []
  );

  const handleSave = React.useCallback(async () => {
    if (!onSave) {
      resolveRef.current?.('save');
      resolveRef.current = null;
      setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
      return;
    }

    setDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const success = await onSave();
      if (success) {
        resolveRef.current?.('save');
        resolveRef.current = null;
        setDialog((prev) => ({
          ...prev,
          isOpen: false,
          isLoading: false,
          resolve: null,
        }));
      } else {
        // 저장 실패 시 다이얼로그 유지
        setDialog((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      // 저장 실패 시 다이얼로그 유지
      setDialog((prev) => ({ ...prev, isLoading: false }));
    }
  }, [onSave]);

  const handleDiscard = React.useCallback(() => {
    if (dialog.isLoading) return;
    resolveRef.current?.('discard');
    resolveRef.current = null;
    setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialog.isLoading]);

  const handleCancel = React.useCallback(() => {
    if (dialog.isLoading) return;
    resolveRef.current?.('cancel');
    resolveRef.current = null;
    setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialog.isLoading]);

  return (
    <UnsavedChangesDialogContext.Provider value={{ showUnsavedChangesDialog }}>
      {children}
      <AlertDialog
        open={dialog.isOpen}
        onOpenChange={(open) => {
          if (!open && !dialog.isLoading) {
            handleCancel();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            {/* 취소 버튼 - 현재 페이지에 머무름 */}
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={dialog.isLoading}
              className="sm:order-1"
            >
              취소
            </Button>
            {/* 저장 안 함 버튼 - 저장 없이 이동 */}
            <Button
              variant="ghost"
              onClick={handleDiscard}
              disabled={dialog.isLoading}
              className="text-muted-foreground hover:text-foreground sm:order-2"
            >
              저장 안 함
            </Button>
            {/* 저장하고 나가기 버튼 */}
            <Button
              onClick={handleSave}
              disabled={dialog.isLoading}
              className="sm:order-3"
            >
              {dialog.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장하고 나가기'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesDialogContext.Provider>
  );
}
