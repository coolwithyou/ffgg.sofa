'use client';

/**
 * 확인 다이얼로그 컴포넌트
 * confirm() 대신 사용하는 UI 일관성 있는 모달
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AlertDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface AlertDialogContextType {
  confirm: (options: AlertDialogOptions) => Promise<boolean>;
}

const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined);

export function useAlertDialog(): AlertDialogContextType {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error('useAlertDialog must be used within an AlertDialogProvider');
  }
  return context;
}

interface AlertDialogProviderProps {
  children: ReactNode;
}

interface DialogState extends AlertDialogOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

export function AlertDialogProvider({ children }: AlertDialogProviderProps) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  });

  const confirm = useCallback((options: AlertDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        ...options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    dialog.resolve?.(true);
    setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialog.resolve]);

  const handleCancel = useCallback(() => {
    dialog.resolve?.(false);
    setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialog.resolve]);

  return (
    <AlertDialogContext.Provider value={{ confirm }}>
      {children}
      {dialog.isOpen && (
        <AlertDialogModal
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          cancelText={dialog.cancelText}
          variant={dialog.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </AlertDialogContext.Provider>
  );
}

interface AlertDialogModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

function AlertDialogModal({
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
}: AlertDialogModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* 다이얼로그 */}
      <div
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <h2
          id="alert-dialog-title"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <p
          id="alert-dialog-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          {message}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
