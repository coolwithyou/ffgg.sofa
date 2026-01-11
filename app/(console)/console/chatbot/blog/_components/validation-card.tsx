// app/(console)/console/chatbot/blog/_components/validation-card.tsx

import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import type { ValidationSessionWithDocument } from '../validation/actions';
import { FileText, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ValidationCardProps {
  session: ValidationSessionWithDocument;
}

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  pending: { label: '대기 중', color: 'bg-muted text-muted-foreground' },
  analyzing: { label: '분석 중', color: 'bg-primary/10 text-primary' },
  extracting_claims: { label: 'Claim 추출 중', color: 'bg-primary/10 text-primary' },
  verifying: { label: '검증 중', color: 'bg-primary/10 text-primary' },
  ready_for_review: { label: '검토 대기', color: 'bg-yellow-500/10 text-yellow-500' },
  reviewing: { label: '검토 중', color: 'bg-yellow-500/10 text-yellow-500' },
  approved: { label: '승인됨', color: 'bg-green-500/10 text-green-500' },
  rejected: { label: '거부됨', color: 'bg-destructive/10 text-destructive' },
  expired: { label: '만료됨', color: 'bg-muted text-muted-foreground' },
};

export function ValidationCard({ session }: ValidationCardProps) {
  const status = statusConfig[session.status] || statusConfig.pending;
  const isClickable = ['ready_for_review', 'reviewing'].includes(session.status);

  const content = (
    <Card
      className={`transition-colors ${isClickable ? 'cursor-pointer hover:border-primary/50' : 'opacity-75'}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              {session.document?.filename || '문서'}
            </CardTitle>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
          >
            {status.label}
          </span>
        </div>
        <CardDescription className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {session.createdAt
            ? formatDistanceToNow(new Date(session.createdAt), {
                addSuffix: true,
                locale: ko,
              })
            : '날짜 없음'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* 검증 통계 */}
        {(session.totalClaims ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-green-500/10 p-2">
              <div className="text-lg font-semibold text-green-500">
                {session.supportedCount ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">지지됨</div>
            </div>
            <div className="rounded-md bg-destructive/10 p-2">
              <div className="text-lg font-semibold text-destructive">
                {session.contradictedCount ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">모순</div>
            </div>
            <div className="rounded-md bg-yellow-500/10 p-2">
              <div className="text-lg font-semibold text-yellow-500">
                {session.notFoundCount ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">근거 없음</div>
            </div>
          </div>
        )}

        {/* 고위험 경고 */}
        {(session.highRiskCount ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {session.highRiskCount}개 고위험 항목
          </div>
        )}

        {/* 위험도 점수 */}
        {session.riskScore !== null && session.riskScore !== undefined && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">위험도</span>
              <span
                className={
                  session.riskScore > 0.5 ? 'text-destructive' : 'text-green-500'
                }
              >
                {Math.round(session.riskScore * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${
                  session.riskScore > 0.5 ? 'bg-destructive' : 'bg-green-500'
                }`}
                style={{ width: `${session.riskScore * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isClickable) {
    return (
      <Link href={`/console/chatbot/blog/validation/${session.id}`}>
        {content}
      </Link>
    );
  }

  return content;
}
