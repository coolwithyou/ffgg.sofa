// app/(console)/console/chatbot/blog/_components/audit-log-panel.tsx
'use client';

/**
 * 감사 로그 패널 컴포넌트
 *
 * 검증 세션의 모든 액션 히스토리를 시간순으로 표시합니다.
 * 컴플라이언스 및 감사 추적용입니다.
 */

import { useState } from 'react';
import {
  History,
  Eye,
  CheckCircle,
  XCircle,
  Edit,
  Shield,
  ShieldOff,
  FileDown,
  ChevronRight,
  Clock,
  User,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

// 감사 로그 액션 타입
type AuditAction =
  | 'session_viewed'
  | 'session_approved'
  | 'session_rejected'
  | 'session_expired'
  | 'claim_reviewed'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_modified'
  | 'markdown_edited'
  | 'masking_applied'
  | 'masking_revealed'
  | 'export_generated';

interface AuditLog {
  id: string;
  sessionId: string;
  userId: string | null; // 시스템 자동 작업 시 null
  action: AuditAction;
  targetType?: 'session' | 'claim' | 'markdown' | null;
  targetId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string | null;
  // Join된 사용자 정보 (optional)
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

interface AuditLogPanelProps {
  logs: AuditLog[];
  isLoading?: boolean;
  className?: string;
}

const actionConfig: Record<
  AuditAction,
  {
    icon: typeof Eye;
    label: string;
    color: string;
  }
> = {
  session_viewed: {
    icon: Eye,
    label: '세션 조회',
    color: 'text-muted-foreground',
  },
  session_approved: {
    icon: CheckCircle,
    label: '세션 승인',
    color: 'text-green-500',
  },
  session_rejected: {
    icon: XCircle,
    label: '세션 거부',
    color: 'text-destructive',
  },
  session_expired: {
    icon: Clock,
    label: '세션 만료',
    color: 'text-muted-foreground',
  },
  claim_reviewed: {
    icon: Eye,
    label: '주장 검토',
    color: 'text-primary',
  },
  claim_approved: {
    icon: CheckCircle,
    label: '주장 승인',
    color: 'text-green-500',
  },
  claim_rejected: {
    icon: XCircle,
    label: '주장 거부',
    color: 'text-destructive',
  },
  claim_modified: {
    icon: Edit,
    label: '주장 수정',
    color: 'text-yellow-500',
  },
  markdown_edited: {
    icon: Edit,
    label: '마크다운 편집',
    color: 'text-purple-500',
  },
  masking_applied: {
    icon: Shield,
    label: '마스킹 적용',
    color: 'text-primary',
  },
  masking_revealed: {
    icon: ShieldOff,
    label: '마스킹 해제',
    color: 'text-orange-500',
  },
  export_generated: {
    icon: FileDown,
    label: '내보내기',
    color: 'text-muted-foreground',
  },
};

export function AuditLogPanel({
  logs,
  isLoading = false,
  className = '',
}: AuditLogPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-2 ${className}`}>
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">감사 로그</span>
          {logs.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {logs.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            감사 로그
          </SheetTitle>
          <SheetDescription>
            이 검증 세션의 모든 활동 기록입니다
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-6 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <History className="h-8 w-8 mb-2 opacity-50" />
              <p>아직 기록된 활동이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = actionConfig[log.action];
  const Icon = config.icon;

  const createdAt =
    log.createdAt === null
      ? new Date()
      : typeof log.createdAt === 'string'
        ? new Date(log.createdAt)
        : log.createdAt;

  const hasDetails =
    log.previousValue || log.newValue || log.metadata || log.ipAddress;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
          disabled={!hasDetails}
        >
          {/* 아이콘 */}
          <div className={`mt-0.5 ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>

          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">
                {config.label}
              </span>
              {log.targetId && (
                <Badge variant="outline" className="text-xs">
                  {log.targetType}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(createdAt, {
                  addSuffix: true,
                  locale: ko,
                })}
              </span>
              {log.user?.name && (
                <>
                  <span>•</span>
                  <User className="h-3 w-3" />
                  <span>{log.user.name}</span>
                </>
              )}
            </div>
          </div>

          {/* 확장 아이콘 */}
          {hasDetails && (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          )}
        </button>
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-7 pl-3 border-l border-border py-2 space-y-2">
            {/* 변경 내용 */}
            {log.previousValue && (
              <div className="text-xs">
                <span className="text-muted-foreground">이전: </span>
                <code className="bg-muted px-1 py-0.5 rounded text-destructive">
                  {truncateText(log.previousValue, 100)}
                </code>
              </div>
            )}
            {log.newValue && (
              <div className="text-xs">
                <span className="text-muted-foreground">변경: </span>
                <code className="bg-muted px-1 py-0.5 rounded text-green-500">
                  {truncateText(log.newValue, 100)}
                </code>
              </div>
            )}

            {/* 메타데이터 */}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">메타데이터: </span>
                <code className="bg-muted px-1 py-0.5 rounded">
                  {JSON.stringify(log.metadata)}
                </code>
              </div>
            )}

            {/* 클라이언트 정보 */}
            {log.ipAddress && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                <span>{log.ipAddress}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export default AuditLogPanel;
