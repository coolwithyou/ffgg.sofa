'use client';

/**
 * AlertDialog 컴포넌트
 * shadcn/ui 스타일 + Radix UI 기반
 * confirm() 대신 사용하는 UI 일관성 있는 모달
 */

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';

// ============================================
// Radix UI 기반 AlertDialog 프리미티브 컴포넌트
// ============================================

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
      className
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-lg sm:rounded-lg',
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    variant?: 'default' | 'destructive';
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variantStyles = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    // shadcn/ui 패턴: destructive는 outline 스타일 (빨간 텍스트 + 투명 배경)
    destructive: 'border border-destructive bg-transparent text-destructive hover:bg-destructive/10',
  };

  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
});
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      'mt-2 inline-flex h-10 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:mt-0',
      className
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

// ============================================
// useAlertDialog 훅 (기존 API 호환)
// ============================================

interface AlertDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  /** 비동기 콜백 모드: 제공 시 훅이 로딩/에러 상태 자동 관리 */
  onConfirm?: () => Promise<void>;
}

interface AlertDialogContextType {
  confirm: (options: AlertDialogOptions) => Promise<boolean>;
}

const AlertDialogContext = React.createContext<AlertDialogContextType | undefined>(undefined);

export function useAlertDialog(): AlertDialogContextType {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error('useAlertDialog must be used within an AlertDialogProvider');
  }
  return context;
}

interface AlertDialogProviderProps {
  children: React.ReactNode;
}

interface DialogState extends AlertDialogOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
  /** 비동기 작업 진행 중 여부 */
  isLoading: boolean;
  /** 에러 발생 시 표시할 메시지 */
  errorMessage: string | null;
}

export function AlertDialogProvider({ children }: AlertDialogProviderProps) {
  const [dialog, setDialog] = React.useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
    isLoading: false,
    errorMessage: null,
  });

  // resolve 함수를 ref로 관리하여 클로저 문제 방지
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((options: AlertDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        isOpen: true,
        ...options,
        resolve,
        isLoading: false,
        errorMessage: null,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(async () => {
    // onConfirm 콜백이 있으면 비동기 처리
    if (dialog.onConfirm) {
      setDialog((prev) => ({ ...prev, isLoading: true, errorMessage: null }));

      try {
        await dialog.onConfirm();
        // 성공: 다이얼로그 닫기 + true 반환
        resolveRef.current?.(true);
        resolveRef.current = null;
        setDialog((prev) => ({
          ...prev,
          isOpen: false,
          isLoading: false,
          resolve: null,
        }));
      } catch (error) {
        // 실패: 에러 메시지 표시하고 다이얼로그 유지
        const errorMsg =
          error instanceof Error ? error.message : '오류가 발생했습니다.';
        setDialog((prev) => ({
          ...prev,
          isLoading: false,
          errorMessage: errorMsg,
        }));
      }
    } else {
      // 기존 동작: 즉시 닫고 true 반환
      resolveRef.current?.(true);
      resolveRef.current = null;
      setDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
    }
  }, [dialog.onConfirm]);

  const handleCancel = React.useCallback(() => {
    // 로딩 중에는 취소 불가
    if (dialog.isLoading) return;

    resolveRef.current?.(false);
    resolveRef.current = null;
    setDialog((prev) => ({
      ...prev,
      isOpen: false,
      resolve: null,
      errorMessage: null,
    }));
  }, [dialog.isLoading]);

  return (
    <AlertDialogContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog
        open={dialog.isOpen}
        onOpenChange={(open) => {
          // 로딩 중에는 외부 클릭으로 닫기 방지
          if (!open && !dialog.isLoading) {
            handleCancel();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog.message}</AlertDialogDescription>
            {/* 에러 메시지 표시 */}
            {dialog.errorMessage && (
              <p className="mt-2 text-sm text-destructive">
                {dialog.errorMessage}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancel}
              disabled={dialog.isLoading}
            >
              {dialog.cancelText || '취소'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // Radix 기본 닫기 방지
                handleConfirm();
              }}
              variant={dialog.variant}
              disabled={dialog.isLoading}
            >
              {dialog.isLoading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner className="h-4 w-4" />
                  처리 중...
                </span>
              ) : (
                dialog.confirmText || '확인'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertDialogContext.Provider>
  );
}

/** 로딩 스피너 컴포넌트 */
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Export all primitives
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
