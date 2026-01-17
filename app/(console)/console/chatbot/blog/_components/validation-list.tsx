// app/(console)/console/chatbot/blog/_components/validation-list.tsx

'use client';

import { useState, useEffect } from 'react';
import { ValidationCard } from './validation-card';
import type { ValidationSessionWithDocument } from '../validation/actions';
import { deleteValidationSession } from '../validation/actions';
import { useAlertDialog } from '@/components/ui/alert-dialog';

interface ValidationListProps {
  sessions: ValidationSessionWithDocument[];
  onRefresh: () => void;
}

export function ValidationList({ sessions: initialSessions, onRefresh }: ValidationListProps) {
  // 로컬 상태로 관리하여 삭제 시 즉시 UI 업데이트
  const [sessions, setSessions] = useState<ValidationSessionWithDocument[]>(initialSessions);
  const { confirm } = useAlertDialog();

  // 서버에서 재검증된 데이터로 동기화
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // 삭제 핸들러
  const handleDelete = async (id: string, filename: string) => {
    await confirm({
      title: '검증 세션 삭제',
      message: `"${filename}" 문서의 검증 세션을 삭제하시겠습니까?\n관련된 모든 검토 데이터가 함께 삭제됩니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
      onConfirm: async () => {
        const result = await deleteValidationSession(id);

        if (!result.success) {
          throw new Error(result.error || '삭제 중 오류가 발생했습니다.');
        }

        // 성공: 로컬 상태에서 해당 세션 제거
        setSessions((prev) => prev.filter((s) => s.id !== id));
      },
    });
  };

  // 상태별 그룹핑
  const pending = sessions.filter((s) =>
    ['ready_for_review', 'reviewing'].includes(s.status)
  );
  const processing = sessions.filter((s) =>
    ['pending', 'analyzing', 'extracting_claims', 'verifying'].includes(s.status)
  );
  const completed = sessions.filter((s) =>
    ['approved', 'rejected', 'expired'].includes(s.status)
  );

  return (
    <div className="space-y-8">
      {/* 검토 대기 - 삭제 가능 */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            검토 대기 ({pending.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((session) => (
              <ValidationCard
                key={session.id}
                session={session}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* 처리 중 - 삭제 불가 (onDelete 미전달) */}
      {processing.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            처리 중 ({processing.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processing.map((session) => (
              <ValidationCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {/* 완료됨 - 삭제 가능 */}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            완료됨 ({completed.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((session) => (
              <ValidationCard
                key={session.id}
                session={session}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
