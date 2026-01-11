// app/(console)/console/chatbot/blog/_components/validation-list.tsx

import { ValidationCard } from './validation-card';
import type { ValidationSessionWithDocument } from '../validation/actions';

interface ValidationListProps {
  sessions: ValidationSessionWithDocument[];
  onRefresh: () => void;
}

export function ValidationList({ sessions, onRefresh }: ValidationListProps) {
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
      {/* 검토 대기 */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            검토 대기 ({pending.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((session) => (
              <ValidationCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {/* 처리 중 */}
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

      {/* 완료됨 */}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            완료됨 ({completed.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((session) => (
              <ValidationCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
