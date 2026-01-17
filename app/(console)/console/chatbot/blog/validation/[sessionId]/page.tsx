// app/(console)/console/chatbot/blog/validation/[sessionId]/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OriginalViewer } from '../../_components/original-viewer';
import { ReconstructedEditor } from '../../_components/reconstructed-editor';
import { ClaimPanel } from '../../_components/claim-panel';
import { FilterTabs } from '../../_components/filter-tabs';
import { ScrollSyncToggle, type SyncMode } from '../../_components/scroll-sync-toggle';
import { MaskingBadge } from '../../_components/masking-badge';
import { AuditLogPanel } from '../../_components/audit-log-panel';
import { useScrollSync } from '../../_components/use-scroll-sync';
import {
  maskSensitiveInfo,
  unmaskSensitiveInfo,
  type MaskingEntry,
} from '@/lib/knowledge-pages/verification/masking';
import {
  getValidationSessionDetail,
  updateReconstructedMarkdown,
  updateClaimHumanVerdict,
  approveValidationSession,
  rejectValidationSession,
  getValidationAuditLogs,
  logSessionViewed,
  logMaskingRevealed,
} from '../actions';
import type { validationSessions, claims, sourceSpans, validationAuditLogs } from '@/drizzle/schema';
import { ArrowLeft, Check, X, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageStructurePreview } from '../_components/page-structure-preview';
import { MarkdownGuideDialog } from '../_components/markdown-guide-dialog';
import { ValidationProgress } from '../_components/validation-progress';
import { PageLocationSelectDialog } from '../_components/page-location-select-dialog';
import { getKnowledgePagesTree, type KnowledgePageTreeNode } from '../../actions';
import type { DocumentStructure, ProcessingStep } from '@/lib/knowledge-pages/types';

type ValidationSession = typeof validationSessions.$inferSelect;
type Claim = typeof claims.$inferSelect;
type SourceSpan = typeof sourceSpans.$inferSelect;
type AuditLog = typeof validationAuditLogs.$inferSelect;

type FilterType = 'all' | 'high_risk' | 'contradicted' | 'not_found' | 'pending';

export default function DualViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { confirm } = useAlertDialog();

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

  // 거부 다이얼로그 상태
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 위치 선택 다이얼로그 상태
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [existingPages, setExistingPages] = useState<KnowledgePageTreeNode[]>([]);
  const [isRejecting, setIsRejecting] = useState(false);

  // Phase 4 추가 상태
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [syncMode, setSyncMode] = useState<SyncMode>('ratio');
  const [maskings, setMaskings] = useState<MaskingEntry[]>([]);
  const [isMaskingRevealed, setIsMaskingRevealed] = useState(false);
  const [originalMaskings, setOriginalMaskings] = useState<MaskingEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  // 페이지 구조 미리보기 하이라이트 (노드 선택 시)
  const [structureHighlightRange, setStructureHighlightRange] = useState<{
    startLine: number;
    endLine: number;
    startChar: number;
    endChar: number;
  } | null>(null);

  // 스크롤 동기화를 위한 refs
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);

  // 스크롤 동기화 훅
  useScrollSync({
    enabled: scrollSyncEnabled,
    leftRef: leftPanelRef,
    rightRef: middlePanelRef,
    mode: syncMode,
  });

  // 이전 데이터 참조 (깜빡임 방지용 비교)
  const prevSessionRef = useRef<string | null>(null);
  const prevClaimsRef = useRef<string | null>(null);

  // 데이터 로드 (isPolling: 폴링 시 true - 로딩 스피너 표시 안함)
  const loadSession = useCallback(async (isPolling = false) => {
    if (!isPolling) {
      setIsLoading(true);
    }
    try {
      const data = await getValidationSessionDetail(sessionId);

      // 깜빡임 방지: 데이터가 실제로 변경된 경우에만 상태 업데이트
      const sessionJson = JSON.stringify(data.session);
      const claimsJson = JSON.stringify(data.claims);

      const hasSessionChanged = prevSessionRef.current !== sessionJson;
      const hasClaimsChanged = prevClaimsRef.current !== claimsJson;

      if (hasSessionChanged) {
        prevSessionRef.current = sessionJson;
        setSession(data.session);

        // 재구성 텍스트에서 민감정보 마스킹 적용 (세션이 변경된 경우에만)
        const markdown = data.session.reconstructedMarkdown || '';
        const { maskedText, maskings: foundMaskings } = maskSensitiveInfo(markdown);
        setReconstructed(maskedText);
        setMaskings(foundMaskings);
        setOriginalMaskings(foundMaskings);
      }

      if (hasClaimsChanged) {
        prevClaimsRef.current = claimsJson;
        setClaimsData(data.claims);
        setSourceSpansMap(new Map(Object.entries(data.sourceSpans)));
      }

      // 세션 조회 감사 로그 (최초 로드 시에만)
      if (!isPolling) {
        logSessionViewed(sessionId);
      }
    } catch {
      toast.error('세션을 불러오는데 실패했습니다');
      router.push('../validation');
    } finally {
      if (!isPolling) {
        setIsLoading(false);
      }
    }
  }, [sessionId, router]);

  // 감사 로그 로드
  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    try {
      const logs = await getValidationAuditLogs(sessionId);
      setAuditLogs(logs);
    } catch {
      console.error('Failed to load audit logs');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
    loadAuditLogs();
  }, [loadSession, loadAuditLogs]);

  // 위치 선택을 위한 기존 페이지 트리 로드
  useEffect(() => {
    if (session?.chatbotId) {
      getKnowledgePagesTree(session.chatbotId).then(setExistingPages).catch(console.error);
    }
  }, [session?.chatbotId]);

  // 처리 중인 세션 자동 폴링 (상태별 차등 주기)
  useEffect(() => {
    if (!session) return;

    // 처리 중인 상태일 때만 폴링
    const isProcessing = ['pending', 'analyzing', 'extracting_claims', 'verifying'].includes(
      session.status
    );

    if (!isProcessing) return;

    // 상태별 차등 폴링 주기 (ms)
    const getPollingInterval = (status: string): number => {
      switch (status) {
        case 'pending':
        case 'analyzing':
          return 3000; // 초기 단계: 3초 (빠른 피드백)
        case 'extracting_claims':
        case 'verifying':
          return 5000; // 검증 단계: 5초
        default:
          return 10000; // 기본: 10초
      }
    };

    const pollingInterval = getPollingInterval(session.status);

    const interval = setInterval(() => {
      loadSession(true); // isPolling=true로 호출 (로딩 스피너 없이)
      loadAuditLogs();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [session?.status, loadSession, loadAuditLogs]);

  // 페이지 구조 노드 선택 핸들러 (라인 → 문자 위치 변환)
  const handleStructureNodeSelect = useCallback(
    (startLine: number, endLine: number) => {
      const lines = reconstructed.split('\n');
      let startChar = 0;
      let endChar = 0;

      // startLine까지의 문자 수 계산 (1-indexed)
      for (let i = 0; i < startLine - 1 && i < lines.length; i++) {
        startChar += lines[i].length + 1; // +1 for newline
      }

      // endLine까지의 문자 수 계산
      for (let i = 0; i < endLine && i < lines.length; i++) {
        endChar += lines[i].length + 1;
      }
      endChar = Math.max(endChar - 1, startChar); // 마지막 줄바꿈 제외

      setStructureHighlightRange({
        startLine,
        endLine,
        startChar,
        endChar,
      });

      // 선택된 Claim 해제 (페이지 구조 하이라이트 우선)
      setSelectedClaimId(null);
    },
    [reconstructed]
  );

  // 마스킹 토글
  const handleToggleMasking = useCallback(async () => {
    if (isMaskingRevealed) {
      // 마스킹 다시 적용
      const { maskedText, maskings: newMaskings } = maskSensitiveInfo(
        unmaskSensitiveInfo(reconstructed, maskings)
      );
      setReconstructed(maskedText);
      setMaskings(newMaskings);
      setIsMaskingRevealed(false);
    } else {
      // 마스킹 해제
      const unmasked = unmaskSensitiveInfo(reconstructed, maskings);
      setReconstructed(unmasked);
      setIsMaskingRevealed(true);

      // 감사 로그 기록
      await logMaskingRevealed(sessionId);
      loadAuditLogs();
    }
  }, [isMaskingRevealed, reconstructed, maskings, sessionId, loadAuditLogs]);

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
      // 마스킹된 상태라면 마스킹 해제 후 저장
      const textToSave = isMaskingRevealed
        ? reconstructed
        : unmaskSensitiveInfo(reconstructed, maskings);

      await updateReconstructedMarkdown(sessionId, textToSave);
      toast.success('저장되었습니다');
      loadAuditLogs();
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
      await updateClaimHumanVerdict(claimId, verdict, note, sessionId);
      setClaimsData((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? { ...c, humanVerdict: verdict, humanNote: note ?? null, reviewedAt: new Date() }
            : c
        )
      );
      toast.success('검토 결과가 저장되었습니다');
      loadAuditLogs();
    } catch {
      toast.error('저장에 실패했습니다');
    }
  };

  // 승인 - 위치 선택 다이얼로그 열기
  const handleApprove = () => {
    if (highRiskUnreviewed > 0) {
      toast.error(`${highRiskUnreviewed}개의 고위험 항목을 먼저 검토하세요`);
      return;
    }
    setIsLocationDialogOpen(true);
  };

  // 위치 선택 후 실제 승인 처리
  const handleConfirmApproval = async (parentPageId: string | null) => {
    setIsApproving(true);
    try {
      const result = await approveValidationSession(sessionId, parentPageId);
      if (result.success) {
        toast.success(`${result.pagesCount}개의 페이지가 생성되었습니다`);
        router.push('/console/chatbot/blog');
      }
    } catch {
      toast.error('승인에 실패했습니다');
    } finally {
      setIsApproving(false);
      setIsLocationDialogOpen(false);
    }
  };

  // 거부 다이얼로그 열기
  const handleRejectClick = () => {
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  // 거부 확인
  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      toast.error('거부 사유를 입력해주세요');
      return;
    }

    setIsRejecting(true);
    try {
      await rejectValidationSession(sessionId, rejectReason.trim());
      toast.success('검증이 거부되었습니다');
      setIsRejectDialogOpen(false);
      router.push('/console/chatbot/blog/validation');
    } catch {
      toast.error('거부에 실패했습니다');
    } finally {
      setIsRejecting(false);
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
      {/* 상단 바 - 2행 구성 */}
      <header className="border-b border-border">
        {/* 1행: 네비게이션 및 필터 */}
        <div className="flex h-12 items-center gap-4 border-b border-border/50 px-4">
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
              {highRiskUnreviewed}개 고위험 미검토
            </span>
          )}

          <Button variant="outline" size="sm" onClick={handleRejectClick}>
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
            승인
          </Button>
        </div>

        {/* 2행: 도구 버튼들 */}
        <div className="flex h-10 items-center gap-3 bg-muted/30 px-4">
          {/* 스크롤 동기화 토글 */}
          <ScrollSyncToggle
            enabled={scrollSyncEnabled}
            onToggle={setScrollSyncEnabled}
            mode={syncMode}
            onModeChange={setSyncMode}
          />

          <div className="h-4 w-px bg-border" />

          {/* 마스킹 배지 */}
          <MaskingBadge
            maskings={originalMaskings}
            isRevealed={isMaskingRevealed}
            onToggleReveal={handleToggleMasking}
            canReveal={originalMaskings.length > 0}
          />

          <div className="h-4 w-px bg-border" />

          {/* 감사 로그 패널 */}
          <AuditLogPanel logs={auditLogs} isLoading={isLoadingAuditLogs} />

          <div className="h-4 w-px bg-border" />

          {/* 페이지 구조 미리보기 */}
          <PageStructurePreview
            structure={session.structureJson as DocumentStructure | null}
            markdown={reconstructed}
            onNodeSelect={handleStructureNodeSelect}
          />
        </div>
      </header>

      {/* 3열 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 원본 뷰어 */}
        <div
          ref={leftPanelRef}
          className="w-[35%] overflow-auto border-r border-border"
        >
          <div className="sticky top-0 z-10 flex h-10 items-center border-b border-border bg-card px-4">
            <h3 className="text-sm font-medium text-muted-foreground">원본 문서</h3>
          </div>
          <OriginalViewer
            content={session.originalText}
            highlightedSpans={selectedSourceSpans}
          />
        </div>

        {/* 중앙: 재구성 에디터 */}
        <div
          ref={middlePanelRef}
          className="w-[40%] overflow-auto border-r border-border"
        >
          <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-border bg-card px-4">
            <h3 className="text-sm font-medium text-muted-foreground">재구성 결과</h3>
            <div className="flex items-center gap-1">
              <MarkdownGuideDialog />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveReconstructed}
                disabled={isSaving || !reconstructed}
              >
                <Save className="mr-1 h-4 w-4" />
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
          {/* 재구성 결과가 비어있을 때 상태 표시 */}
          {!reconstructed ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              {['pending', 'analyzing', 'extracting_claims', 'verifying'].includes(session.status) ? (
                <>
                  {/* 진행 상태 표시 컴포넌트 */}
                  <div className="w-full max-w-md">
                    <ValidationProgress
                      currentStep={(session.currentStep as ProcessingStep) || null}
                      completedSteps={session.completedSteps ?? 0}
                      totalSteps={session.totalSteps ?? 4}
                      totalClaims={session.totalClaims ?? undefined}
                      processedClaims={session.processedClaims ?? undefined}
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      AI가 문서를 분석하고 마크다운을 생성하고 있습니다.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSession()}
                  >
                    <Loader2 className="mr-1 h-4 w-4" />
                    새로고침
                  </Button>
                </>
              ) : session.status === 'rejected' ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-destructive">
                      처리 실패
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      문서 처리 중 오류가 발생했습니다.
                      {session.reviewNote && (
                        <span className="mt-2 block text-destructive">
                          사유: {session.reviewNote}
                        </span>
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground">
                      재구성 결과 없음
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      AI 재구성 결과가 비어 있습니다.
                      <br />Inngest Dev Server가 실행 중인지 확인해주세요.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSession()}
                  >
                    <Loader2 className="mr-1 h-4 w-4" />
                    새로고침
                  </Button>
                </>
              )}
            </div>
          ) : (
            <ReconstructedEditor
              value={reconstructed}
              onChange={setReconstructed}
              highlightedRange={
                // 페이지 구조 선택 우선, 없으면 Claim 선택 사용
                structureHighlightRange ||
                (selectedClaim?.reconstructedLocation as
                  | {
                      startLine: number;
                      endLine: number;
                      startChar: number;
                      endChar: number;
                    }
                  | undefined)
              }
            />
          )}
        </div>

        {/* 우측: Claim 패널 */}
        <div className="w-[25%] overflow-auto bg-muted/30">
          <div className="sticky top-0 z-10 flex h-10 items-center border-b border-border bg-muted/50 px-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              검증 항목 ({filteredClaims.length})
            </h3>
          </div>
          <ClaimPanel
            claims={filteredClaims}
            selectedId={selectedClaimId}
            onSelect={(id) => {
              setSelectedClaimId(id);
              // Claim 선택 시 페이지 구조 하이라이트 해제
              setStructureHighlightRange(null);
            }}
            onVerdictChange={handleVerdictChange}
          />
        </div>
      </div>

      {/* 거부 사유 입력 다이얼로그 */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>검증 거부</DialogTitle>
            <DialogDescription>
              이 검증 세션을 거부합니다. 거부 사유를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason" className="text-sm font-medium">
              거부 사유
            </Label>
            <Input
              id="reject-reason"
              placeholder="거부 사유를 입력하세요..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRejectConfirm();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isRejecting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isRejecting || !rejectReason.trim()}
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  거부 중...
                </>
              ) : (
                '거부'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 페이지 생성 위치 선택 다이얼로그 */}
      <PageLocationSelectDialog
        open={isLocationDialogOpen}
        onOpenChange={setIsLocationDialogOpen}
        structure={session.structureJson as DocumentStructure | null}
        existingPages={existingPages}
        onConfirm={handleConfirmApproval}
        isLoading={isApproving}
      />
    </div>
  );
}
