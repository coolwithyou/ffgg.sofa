# Phase 3: Dual Viewer UI

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | 원본 ↔ 재구성 비교 및 Claim 검토 UI |
| **산출물** | 검증 목록 페이지 + Dual Viewer 페이지 + 컴포넌트들 |
| **의존성** | Phase 1-2 완료 |
| **예상 기간** | 4일 |

---

## 폴더 구조

```
app/(console)/console/chatbot/blog/
├── validation/
│   ├── page.tsx                      # 검증 대기 목록
│   ├── actions.ts                    # Server Actions
│   └── [sessionId]/
│       └── page.tsx                  # Dual Viewer
└── _components/
    ├── validation-list.tsx           # 검증 세션 목록
    ├── validation-card.tsx           # 세션 카드
    ├── dual-viewer.tsx               # 3열 레이아웃 컨테이너
    ├── original-viewer.tsx           # 원본 텍스트 뷰어
    ├── reconstructed-editor.tsx      # 재구성 마크다운 에디터
    ├── claim-panel.tsx               # Claim 목록 패널
    ├── claim-item.tsx                # 개별 Claim 카드
    ├── source-highlight.tsx          # 원문 하이라이트 유틸
    ├── verdict-badge.tsx             # 판정 배지
    ├── risk-badge.tsx                # 위험도 배지
    └── filter-tabs.tsx               # 필터 탭
```

---

## 검증 목록 페이지

### validation/page.tsx

```tsx
// app/(console)/console/chatbot/blog/validation/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentChatbot } from '../../../hooks/use-console-state';
import { NoChatbotState } from '../../../components/no-chatbot-state';
import { ValidationList } from '../_components/validation-list';
import { getValidationSessions } from './actions';
import type { ValidationSession } from '@/drizzle/schema';
import { RefreshCw, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ValidationPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [sessions, setSessions] = useState<ValidationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!currentChatbot?.id) return;
    setIsLoading(true);
    try {
      const data = await getValidationSessions(currentChatbot.id);
      setSessions(data);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatbot?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!currentChatbot) {
    return <NoChatbotState title="챗봇을 선택하세요" />;
  }

  const pendingCount = sessions.filter(
    (s) => s.status === 'ready_for_review' || s.status === 'reviewing'
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">문서 검증</h1>
          <p className="text-sm text-muted-foreground">
            AI가 재구성한 문서를 검토하고 승인합니다
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {pendingCount}건 검토 대기
            </span>
          )}
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={isLoading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </header>

      {/* 목록 */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <ValidationList sessions={sessions} onRefresh={loadSessions} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileCheck className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          검증 대기 중인 문서가 없습니다
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          문서를 업로드하면 AI가 자동으로 분석을 시작합니다
        </p>
      </div>
    </div>
  );
}
```

---

## Dual Viewer 페이지

### validation/[sessionId]/page.tsx

```tsx
// app/(console)/console/chatbot/blog/validation/[sessionId]/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OriginalViewer } from '../../_components/original-viewer';
import { ReconstructedEditor } from '../../_components/reconstructed-editor';
import { ClaimPanel } from '../../_components/claim-panel';
import { FilterTabs } from '../../_components/filter-tabs';
import {
  getValidationSessionDetail,
  updateReconstructedMarkdown,
  updateClaimHumanVerdict,
  approveValidationSession,
  rejectValidationSession,
} from '../actions';
import type { ValidationSession, Claim, SourceSpan } from '@/drizzle/schema';
import { ArrowLeft, Check, X, AlertTriangle, Save } from 'lucide-react';

type FilterType = 'all' | 'high_risk' | 'contradicted' | 'not_found' | 'pending';

export default function DualViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  // 데이터 상태
  const [session, setSession] = useState<ValidationSession | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sourceSpansMap, setSourceSpansMap] = useState<Map<string, SourceSpan[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // UI 상태
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [reconstructed, setReconstructed] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // 데이터 로드
  const loadSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getValidationSessionDetail(sessionId);
      setSession(data.session);
      setClaims(data.claims);
      setSourceSpansMap(new Map(Object.entries(data.sourceSpans)));
      setReconstructed(data.session.reconstructedMarkdown || '');
    } catch (error) {
      toast.error('세션을 불러오는데 실패했습니다');
      router.push('../validation');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // 필터링된 Claim
  const filteredClaims = claims.filter((claim) => {
    switch (activeFilter) {
      case 'high_risk':
        return claim.riskLevel === 'high';
      case 'contradicted':
        return claim.verdict === 'contradicted';
      case 'not_found':
        return claim.verdict === 'not_found';
      case 'pending':
        return !claim.humanVerdict;
      default:
        return true;
    }
  });

  // 선택된 Claim
  const selectedClaim = claims.find((c) => c.id === selectedClaimId);
  const selectedSourceSpans = selectedClaimId
    ? sourceSpansMap.get(selectedClaimId) || []
    : [];

  // 미검토 High Risk 개수
  const highRiskUnreviewed = claims.filter(
    (c) => c.riskLevel === 'high' && !c.humanVerdict
  ).length;

  // 재구성 마크다운 저장
  const handleSaveReconstructed = async () => {
    setIsSaving(true);
    try {
      await updateReconstructedMarkdown(sessionId, reconstructed);
      toast.success('저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  // Claim 검토 결과 저장
  const handleVerdictChange = async (
    claimId: string,
    verdict: 'approved' | 'rejected' | 'modified',
    note?: string
  ) => {
    try {
      await updateClaimHumanVerdict(claimId, verdict, note);
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? { ...c, humanVerdict: verdict, humanNote: note, reviewedAt: new Date() }
            : c
        )
      );
      toast.success('검토 결과가 저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
  };

  // 승인
  const handleApprove = async () => {
    if (highRiskUnreviewed > 0) {
      toast.error(`${highRiskUnreviewed}개의 고위험 항목을 먼저 검토하세요`);
      return;
    }

    setIsApproving(true);
    try {
      const result = await approveValidationSession(sessionId);
      if (result.success) {
        toast.success(`${result.pagesCount}개의 페이지가 생성되었습니다`);
        router.push('../blog');
      }
    } catch (error) {
      toast.error('승인에 실패했습니다');
    } finally {
      setIsApproving(false);
    }
  };

  // 거부
  const handleReject = async () => {
    const reason = prompt('거부 사유를 입력하세요:');
    if (!reason) return;

    try {
      await rejectValidationSession(sessionId, reason);
      toast.success('검증이 거부되었습니다');
      router.push('../validation');
    } catch (error) {
      toast.error('거부에 실패했습니다');
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 상단 바 */}
      <header className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('../validation')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          목록
        </Button>

        <FilterTabs
          tabs={[
            { id: 'all', label: '전체', count: claims.length },
            { id: 'high_risk', label: '고위험', count: claims.filter((c) => c.riskLevel === 'high').length },
            { id: 'contradicted', label: '모순', count: claims.filter((c) => c.verdict === 'contradicted').length },
            { id: 'not_found', label: '근거 없음', count: claims.filter((c) => c.verdict === 'not_found').length },
            { id: 'pending', label: '미검토', count: claims.filter((c) => !c.humanVerdict).length },
          ]}
          activeTab={activeFilter}
          onChange={(tab) => setActiveFilter(tab as FilterType)}
        />

        <div className="flex-1" />

        {highRiskUnreviewed > 0 && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {highRiskUnreviewed}개 고위험 항목 미검토
          </span>
        )}

        <Button variant="outline" size="sm" onClick={handleReject}>
          <X className="mr-1 h-4 w-4" />
          거부
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={highRiskUnreviewed > 0 || isApproving}
        >
          {isApproving ? (
            <div className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          승인 및 저장
        </Button>
      </header>

      {/* 3열 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 원본 뷰어 */}
        <div className="w-[35%] overflow-auto border-r border-border">
          <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">원본 문서</h3>
          </div>
          <OriginalViewer
            content={session.originalText}
            highlightedSpans={selectedSourceSpans}
          />
        </div>

        {/* 중앙: 재구성 에디터 */}
        <div className="w-[40%] overflow-auto border-r border-border">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">재구성 결과</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveReconstructed}
              disabled={isSaving}
            >
              <Save className="mr-1 h-4 w-4" />
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
          <ReconstructedEditor
            value={reconstructed}
            onChange={setReconstructed}
            highlightedRange={selectedClaim?.reconstructedLocation as any}
          />
        </div>

        {/* 우측: Claim 패널 */}
        <div className="w-[25%] overflow-auto bg-muted/30">
          <div className="sticky top-0 z-10 border-b border-border bg-muted/50 px-4 py-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              검증 항목 ({filteredClaims.length})
            </h3>
          </div>
          <ClaimPanel
            claims={filteredClaims}
            selectedId={selectedClaimId}
            onSelect={setSelectedClaimId}
            onVerdictChange={handleVerdictChange}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Server Actions

### validation/actions.ts

```typescript
// app/(console)/console/chatbot/blog/validation/actions.ts

'use server';

import { db } from '@/lib/db';
import { validationSessions, claims, sourceSpans, knowledgePages } from '@/drizzle/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createPagesFromStructure } from '@/lib/knowledge-pages/document-to-pages';

/**
 * 검증 세션 목록 조회
 */
export async function getValidationSessions(chatbotId: string) {
  const sessions = await db.query.validationSessions.findMany({
    where: eq(validationSessions.chatbotId, chatbotId),
    orderBy: [desc(validationSessions.createdAt)],
    with: {
      document: {
        columns: { title: true, fileType: true },
      },
    },
  });
  return sessions;
}

/**
 * 검증 세션 상세 조회 (Claims + SourceSpans 포함)
 */
export async function getValidationSessionDetail(sessionId: string) {
  const session = await db.query.validationSessions.findFirst({
    where: eq(validationSessions.id, sessionId),
  });
  if (!session) throw new Error('Session not found');

  const allClaims = await db.query.claims.findMany({
    where: eq(claims.sessionId, sessionId),
    orderBy: [claims.sortOrder],
  });

  // SourceSpans를 Claim ID별로 그룹핑
  const claimIds = allClaims.map((c) => c.id);
  const allSpans = claimIds.length > 0
    ? await db.query.sourceSpans.findMany({
        where: inArray(sourceSpans.claimId, claimIds),
      })
    : [];

  const sourceSpansMap: Record<string, typeof allSpans> = {};
  for (const span of allSpans) {
    if (!sourceSpansMap[span.claimId]) {
      sourceSpansMap[span.claimId] = [];
    }
    sourceSpansMap[span.claimId].push(span);
  }

  return { session, claims: allClaims, sourceSpans: sourceSpansMap };
}

/**
 * 재구성 마크다운 수정
 */
export async function updateReconstructedMarkdown(sessionId: string, markdown: string) {
  await db
    .update(validationSessions)
    .set({
      reconstructedMarkdown: markdown,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  return { success: true };
}

/**
 * Claim 검토 결과 저장
 */
export async function updateClaimHumanVerdict(
  claimId: string,
  verdict: 'approved' | 'rejected' | 'modified',
  note?: string
) {
  await db
    .update(claims)
    .set({
      humanVerdict: verdict,
      humanNote: note,
      reviewedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  return { success: true };
}

/**
 * 검증 승인 → Knowledge Pages 생성
 */
export async function approveValidationSession(sessionId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const validationSession = await db.query.validationSessions.findFirst({
    where: eq(validationSessions.id, sessionId),
  });
  if (!validationSession) throw new Error('Session not found');

  // 구조 JSON에서 페이지 생성
  const structure = validationSession.structureJson as any;
  const markdown = validationSession.reconstructedMarkdown || '';

  // 페이지 생성
  const pages = await createPagesFromStructure(
    structure,
    markdown,
    validationSession.chatbotId,
    validationSession.documentId
  );

  // 세션 상태 업데이트
  await db
    .update(validationSessions)
    .set({
      status: 'approved',
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      generatedPagesCount: pages.length,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  revalidatePath('/console/chatbot/blog');

  return { success: true, pagesCount: pages.length };
}

/**
 * 검증 거부
 */
export async function rejectValidationSession(sessionId: string, reason: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  await db
    .update(validationSessions)
    .set({
      status: 'rejected',
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      reviewNote: reason,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  return { success: true };
}
```

---

## 컴포넌트들

### validation-list.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/validation-list.tsx

import { ValidationCard } from './validation-card';
import type { ValidationSession } from '@/drizzle/schema';

interface ValidationListProps {
  sessions: ValidationSession[];
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
```

### validation-card.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/validation-card.tsx

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { VerdictBadge } from './verdict-badge';
import { RiskBadge } from './risk-badge';
import type { ValidationSession } from '@/drizzle/schema';
import { FileText, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ValidationCardProps {
  session: ValidationSession;
}

const statusConfig = {
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
            <CardTitle className="text-base">{session.document?.title || '문서'}</CardTitle>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
        <CardDescription className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true, locale: ko })}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* 검증 통계 */}
        {session.totalClaims > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-green-500/10 p-2">
              <div className="text-lg font-semibold text-green-500">
                {session.supportedCount}
              </div>
              <div className="text-xs text-muted-foreground">지지됨</div>
            </div>
            <div className="rounded-md bg-destructive/10 p-2">
              <div className="text-lg font-semibold text-destructive">
                {session.contradictedCount}
              </div>
              <div className="text-xs text-muted-foreground">모순</div>
            </div>
            <div className="rounded-md bg-yellow-500/10 p-2">
              <div className="text-lg font-semibold text-yellow-500">
                {session.notFoundCount}
              </div>
              <div className="text-xs text-muted-foreground">근거 없음</div>
            </div>
          </div>
        )}

        {/* 고위험 경고 */}
        {session.highRiskCount > 0 && (
          <div className="mt-3 flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {session.highRiskCount}개 고위험 항목
          </div>
        )}

        {/* 위험도 점수 */}
        {session.riskScore !== null && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">위험도</span>
              <span className={session.riskScore > 0.5 ? 'text-destructive' : 'text-green-500'}>
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
```

### claim-panel.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/claim-panel.tsx

import { ClaimItem } from './claim-item';
import type { Claim } from '@/drizzle/schema';

interface ClaimPanelProps {
  claims: Claim[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVerdictChange: (
    claimId: string,
    verdict: 'approved' | 'rejected' | 'modified',
    note?: string
  ) => void;
}

export function ClaimPanel({
  claims,
  selectedId,
  onSelect,
  onVerdictChange,
}: ClaimPanelProps) {
  if (claims.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        해당 조건의 항목이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {claims.map((claim) => (
        <ClaimItem
          key={claim.id}
          claim={claim}
          isSelected={claim.id === selectedId}
          onSelect={() => onSelect(claim.id === selectedId ? null : claim.id)}
          onVerdictChange={onVerdictChange}
        />
      ))}
    </div>
  );
}
```

### claim-item.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/claim-item.tsx

import { Button } from '@/components/ui/button';
import { VerdictBadge } from './verdict-badge';
import { RiskBadge } from './risk-badge';
import type { Claim } from '@/drizzle/schema';
import { cn } from '@/lib/utils';
import { Check, X, Edit, ExternalLink } from 'lucide-react';

interface ClaimItemProps {
  claim: Claim;
  isSelected: boolean;
  onSelect: () => void;
  onVerdictChange: (
    claimId: string,
    verdict: 'approved' | 'rejected' | 'modified',
    note?: string
  ) => void;
}

const claimTypeLabels: Record<string, string> = {
  numeric: '숫자',
  contact: '연락처',
  date: '날짜',
  text: '텍스트',
  list: '목록',
  table: '테이블',
};

export function ClaimItem({
  claim,
  isSelected,
  onSelect,
  onVerdictChange,
}: ClaimItemProps) {
  const isHighRisk = claim.riskLevel === 'high';
  const needsReview = isHighRisk && !claim.humanVerdict;

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        isHighRisk && !claim.humanVerdict && 'border-l-4 border-l-destructive'
      )}
      onClick={onSelect}
    >
      {/* 헤더: 타입 + 위험도 + 판정 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {claimTypeLabels[claim.claimType] || claim.claimType}
        </span>
        <RiskBadge level={claim.riskLevel} />
        <VerdictBadge verdict={claim.verdict} />
        {claim.humanVerdict && (
          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs font-medium text-green-500">
            검토 완료
          </span>
        )}
      </div>

      {/* 본문 */}
      <p className="text-sm text-foreground line-clamp-2">{claim.claimText}</p>

      {/* 검증 상세 */}
      {claim.verificationDetail && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {claim.verificationDetail}
        </p>
      )}

      {/* 사용자 액션 (High Risk만 필수) */}
      {needsReview && (
        <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onVerdictChange(claim.id, 'approved')}
          >
            <Check className="mr-1 h-3 w-3" />
            확인
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onVerdictChange(claim.id, 'rejected')}
          >
            <X className="mr-1 h-3 w-3" />
            거부
          </Button>
        </div>
      )}

      {/* 이미 검토된 경우 */}
      {claim.humanVerdict && claim.humanNote && (
        <p className="mt-2 rounded bg-muted p-2 text-xs text-muted-foreground">
          메모: {claim.humanNote}
        </p>
      )}
    </div>
  );
}
```

### original-viewer.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/original-viewer.tsx

import { useRef, useEffect } from 'react';
import type { SourceSpan } from '@/drizzle/schema';

interface OriginalViewerProps {
  content: string;
  highlightedSpans: SourceSpan[];
}

export function OriginalViewer({ content, highlightedSpans }: OriginalViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 하이라이트된 스팬으로 스크롤
  useEffect(() => {
    if (highlightedSpans.length > 0 && containerRef.current) {
      const firstHighlight = containerRef.current.querySelector('[data-highlight="true"]');
      if (firstHighlight) {
        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedSpans]);

  // 하이라이트 적용된 HTML 생성
  const renderContent = () => {
    if (highlightedSpans.length === 0) {
      return <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>;
    }

    // 스팬을 시작 위치로 정렬
    const sortedSpans = [...highlightedSpans].sort((a, b) => a.startChar - b.startChar);

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    sortedSpans.forEach((span, index) => {
      // 하이라이트 전 텍스트
      if (span.startChar > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>
            {content.slice(lastEnd, span.startChar)}
          </span>
        );
      }

      // 하이라이트된 텍스트
      parts.push(
        <mark
          key={`highlight-${index}`}
          data-highlight="true"
          className="rounded bg-yellow-300/50 px-0.5 dark:bg-yellow-500/30"
        >
          {content.slice(span.startChar, span.endChar)}
        </mark>
      );

      lastEnd = span.endChar;
    });

    // 마지막 텍스트
    if (lastEnd < content.length) {
      parts.push(<span key="text-last">{content.slice(lastEnd)}</span>);
    }

    return <pre className="whitespace-pre-wrap font-sans text-sm">{parts}</pre>;
  };

  return (
    <div ref={containerRef} className="p-4">
      {renderContent()}
    </div>
  );
}
```

### reconstructed-editor.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/reconstructed-editor.tsx

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReconstructedEditorProps {
  value: string;
  onChange: (value: string) => void;
  highlightedRange?: {
    startLine: number;
    endLine: number;
    startChar: number;
    endChar: number;
  };
}

export function ReconstructedEditor({
  value,
  onChange,
  highlightedRange,
}: ReconstructedEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 하이라이트된 위치로 스크롤
  useEffect(() => {
    if (highlightedRange && textareaRef.current) {
      const lines = value.split('\n');
      let charCount = 0;

      for (let i = 0; i < highlightedRange.startLine - 1 && i < lines.length; i++) {
        charCount += lines[i].length + 1; // +1 for newline
      }

      textareaRef.current.setSelectionRange(
        highlightedRange.startChar,
        highlightedRange.endChar
      );
      textareaRef.current.focus();

      // 스크롤 위치 조정
      const lineHeight = 20;
      const scrollTop = (highlightedRange.startLine - 5) * lineHeight;
      textareaRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, [highlightedRange, value]);

  return (
    <div className="flex h-full flex-col">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 resize-none border-none bg-transparent p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-0"
        placeholder="재구성된 마크다운..."
      />
    </div>
  );
}
```

### filter-tabs.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/filter-tabs.tsx

import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function FilterTabs({ tabs, activeTab, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs',
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/20'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

### verdict-badge.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/verdict-badge.tsx

import { cn } from '@/lib/utils';
import { Check, X, HelpCircle, Clock } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: string;
  className?: string;
}

const verdictConfig = {
  supported: {
    label: '지지됨',
    color: 'bg-green-500/10 text-green-500',
    icon: Check,
  },
  contradicted: {
    label: '모순',
    color: 'bg-destructive/10 text-destructive',
    icon: X,
  },
  not_found: {
    label: '근거 없음',
    color: 'bg-yellow-500/10 text-yellow-500',
    icon: HelpCircle,
  },
  pending: {
    label: '검증 중',
    color: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
};

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  const config = verdictConfig[verdict as keyof typeof verdictConfig] || verdictConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
```

### risk-badge.tsx

```tsx
// app/(console)/console/chatbot/blog/_components/risk-badge.tsx

import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface RiskBadgeProps {
  level: string;
  className?: string;
}

const riskConfig = {
  high: {
    label: '고위험',
    color: 'bg-destructive/10 text-destructive',
    icon: AlertTriangle,
  },
  medium: {
    label: '중위험',
    color: 'bg-yellow-500/10 text-yellow-500',
    icon: AlertCircle,
  },
  low: {
    label: '저위험',
    color: 'bg-muted text-muted-foreground',
    icon: Info,
  },
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = riskConfig[level as keyof typeof riskConfig] || riskConfig.low;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
```

---

## 네비게이션 메뉴 추가

### nav-config.ts 수정

```typescript
// app/(console)/console/components/nav/nav-config.ts

// chatbot subItems에 추가
{
  id: 'validation',
  label: '문서 검증',
  href: '/console/chatbot/blog/validation',
}
```

---

## 체크리스트

- [ ] `app/(console)/console/chatbot/blog/validation/` 디렉토리 생성
- [ ] `validation/page.tsx` (목록 페이지) 구현
- [ ] `validation/[sessionId]/page.tsx` (Dual Viewer) 구현
- [ ] `validation/actions.ts` Server Actions 구현
- [ ] `_components/validation-list.tsx` 구현
- [ ] `_components/validation-card.tsx` 구현
- [ ] `_components/claim-panel.tsx` 구현
- [ ] `_components/claim-item.tsx` 구현
- [ ] `_components/original-viewer.tsx` 구현
- [ ] `_components/reconstructed-editor.tsx` 구현
- [ ] `_components/filter-tabs.tsx` 구현
- [ ] `_components/verdict-badge.tsx` 구현
- [ ] `_components/risk-badge.tsx` 구현
- [ ] 네비게이션에 "검증" 메뉴 추가
- [ ] TypeScript 컴파일 확인
- [ ] UI/UX 테스트

---

## 다음 단계

[Phase 4: 고급 기능](./phase-4-advanced-features.md)에서 PDF 렌더링, 스크롤 동기화, 민감정보 마스킹을 구현합니다.

---

*작성일: 2026-01-11*
