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
import type { validationSessions, claims, sourceSpans } from '@/drizzle/schema';
import { ArrowLeft, Check, X, AlertTriangle, Save } from 'lucide-react';

type ValidationSession = typeof validationSessions.$inferSelect;
type Claim = typeof claims.$inferSelect;
type SourceSpan = typeof sourceSpans.$inferSelect;

type FilterType = 'all' | 'high_risk' | 'contradicted' | 'not_found' | 'pending';

export default function DualViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  // 데이터 상태
  const [session, setSession] = useState<ValidationSession | null>(null);
  const [claimsData, setClaimsData] = useState<Claim[]>([]);
  const [sourceSpansMap, setSourceSpansMap] = useState<Map<string, SourceSpan[]>>(
    new Map()
  );
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
      setClaimsData(data.claims);
      setSourceSpansMap(new Map(Object.entries(data.sourceSpans)));
      setReconstructed(data.session.reconstructedMarkdown || '');
    } catch {
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
  const filteredClaims = claimsData.filter((claim) => {
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
  const selectedClaim = claimsData.find((c) => c.id === selectedClaimId);
  const selectedSourceSpans = selectedClaimId
    ? sourceSpansMap.get(selectedClaimId) || []
    : [];

  // 미검토 High Risk 개수
  const highRiskUnreviewed = claimsData.filter(
    (c) => c.riskLevel === 'high' && !c.humanVerdict
  ).length;

  // 재구성 마크다운 저장
  const handleSaveReconstructed = async () => {
    setIsSaving(true);
    try {
      await updateReconstructedMarkdown(sessionId, reconstructed);
      toast.success('저장되었습니다');
    } catch {
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
      setClaimsData((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? { ...c, humanVerdict: verdict, humanNote: note ?? null, reviewedAt: new Date() }
            : c
        )
      );
      toast.success('검토 결과가 저장되었습니다');
    } catch {
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
    } catch {
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
    } catch {
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
            { id: 'all', label: '전체', count: claimsData.length },
            {
              id: 'high_risk',
              label: '고위험',
              count: claimsData.filter((c) => c.riskLevel === 'high').length,
            },
            {
              id: 'contradicted',
              label: '모순',
              count: claimsData.filter((c) => c.verdict === 'contradicted').length,
            },
            {
              id: 'not_found',
              label: '근거 없음',
              count: claimsData.filter((c) => c.verdict === 'not_found').length,
            },
            {
              id: 'pending',
              label: '미검토',
              count: claimsData.filter((c) => !c.humanVerdict).length,
            },
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
            highlightedRange={
              selectedClaim?.reconstructedLocation as
                | {
                    startLine: number;
                    endLine: number;
                    startChar: number;
                    endChar: number;
                  }
                | undefined
            }
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
