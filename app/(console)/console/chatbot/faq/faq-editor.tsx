'use client';

/**
 * FAQ 에디터 메인 컴포넌트
 * 카테고리, Q&A 편집 및 실시간 미리보기
 * Console 마이그레이션
 */

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getFAQDrafts, saveFAQDraft, deleteFAQDraft, uploadQAAsDocument, unlockQA, type FAQDraft } from './actions';
import { type Category, type QAPair } from './utils';
import { CategoryList } from './category-list';
import { QAList } from './qa-list';
import { FAQPreview } from './faq-preview';
import { ExportModal } from './export-modal';
import { toast } from 'sonner';
import { useCurrentChatbot, useTenantSettings } from '../../hooks/use-console-state';
import { NoChatbotState } from '../../components/no-chatbot-state';
// 데이터셋 타입
interface Dataset {
  id: string;
  name: string;
  isDefault: boolean;
}

export function FAQEditor() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { currentChatbot } = useCurrentChatbot();
  const { isAdvancedModeEnabled } = useTenantSettings();

  // 초안 목록 상태 (클라이언트 로드)
  const [drafts, setDrafts] = useState<FAQDraft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true);

  // 현재 편집 중인 초안
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('새 FAQ');
  const [categories, setCategories] = useState<Category[]>([]);
  const [qaPairs, setQAPairs] = useState<QAPair[]>([]);

  // 선택된 카테고리
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categories[0]?.id || null
  );

  // UI 상태
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDraftList, setShowDraftList] = useState(false);
  const [uploadingQAId, setUploadingQAId] = useState<string | null>(null);

  // 데이터셋 상태
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');

  // 확인 다이얼로그 상태
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 초안 목록 로드 (챗봇별)
  useEffect(() => {
    const loadDrafts = async () => {
      if (!currentChatbot?.id) {
        setIsLoadingDrafts(false);
        return;
      }

      setIsLoadingDrafts(true);
      try {
        const loadedDrafts = await getFAQDrafts(currentChatbot.id);
        setDrafts(loadedDrafts);

        // 첫 번째 초안이 있으면 로드
        if (loadedDrafts.length > 0) {
          const firstDraft = loadedDrafts[0];
          setCurrentDraftId(firstDraft.id);
          setDraftName(firstDraft.name);
          setCategories(firstDraft.categories);
          setQAPairs(firstDraft.qaPairs);
          if (firstDraft.categories.length > 0) {
            setSelectedCategoryId(firstDraft.categories[0].id);
          }
        } else {
          // 초안이 없으면 초기화
          setCurrentDraftId(null);
          setDraftName('새 FAQ');
          setCategories([]);
          setQAPairs([]);
          setSelectedCategoryId(null);
        }
      } catch (error) {
        console.error('초안 목록 로드 실패:', error);
        toast.error('로드 실패', { description: 'FAQ 초안을 불러오는데 실패했습니다.' });
      } finally {
        setIsLoadingDrafts(false);
      }
    };

    loadDrafts();
  }, [currentChatbot?.id]);

  // 데이터셋 목록 로드 (현재 챗봇의 연결된 데이터셋만 표시)
  useEffect(() => {
    const loadDatasets = async () => {
      if (!currentChatbot?.id) return;

      try {
        // 현재 챗봇에 연결된 데이터셋만 조회
        const linkedRes = await fetch(`/api/chatbots/${currentChatbot.id}/datasets`);
        const linkedData = await linkedRes.json();

        if (linkedData.datasets && linkedData.datasets.length > 0) {
          setDatasets(linkedData.datasets);
          setSelectedDatasetId(linkedData.datasets[0].id);
        } else {
          setDatasets([]);
          setSelectedDatasetId('');
        }
      } catch (error) {
        console.error('데이터셋 로드 실패:', error);
      }
    };

    loadDatasets();
  }, [currentChatbot?.id]);

  // 자동 저장 (2초 디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftName && (categories.length > 0 || qaPairs.length > 0)) {
        handleSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [draftName, categories, qaPairs]);

  // 저장
  const handleSave = useCallback(async () => {
    if (!currentChatbot?.id) {
      toast.error('챗봇 선택 필요', { description: '챗봇을 먼저 선택해주세요.' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveFAQDraft({
        id: currentDraftId || undefined,
        chatbotId: currentChatbot.id,
        name: draftName,
        categories,
        qaPairs,
      });
      if (!currentDraftId) {
        setCurrentDraftId(result.id);
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('저장 실패', { description: 'FAQ 저장에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  }, [currentDraftId, draftName, categories, qaPairs, currentChatbot?.id]);

  // 새 초안 생성
  const handleNewDraft = useCallback(() => {
    setCurrentDraftId(null);
    setDraftName('새 FAQ');
    setCategories([]);
    setQAPairs([]);
    setSelectedCategoryId(null);
    setLastSaved(null);
    setShowDraftList(false);
  }, []);

  // 초안 불러오기
  const handleLoadDraft = useCallback((draft: FAQDraft) => {
    setCurrentDraftId(draft.id);
    setDraftName(draft.name);
    setCategories(draft.categories);
    setQAPairs(draft.qaPairs);
    setSelectedCategoryId(draft.categories[0]?.id || null);
    setLastSaved(draft.updatedAt);
    setShowDraftList(false);
  }, []);

  // 초안 삭제
  const handleDeleteDraft = useCallback(
    (id: string) => {
      setConfirmDialog({
        isOpen: true,
        title: 'FAQ 초안 삭제',
        message: '이 FAQ 초안을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
        onConfirm: () => {
          startTransition(async () => {
            await deleteFAQDraft(id);
            if (currentDraftId === id) {
              handleNewDraft();
            }
            router.refresh();
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [currentDraftId, handleNewDraft, router]
  );

  // 카테고리 추가
  const handleAddCategory = useCallback(() => {
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: '새 카테고리',
      order: categories.length,
    };
    setCategories([...categories, newCategory]);
    setSelectedCategoryId(newCategory.id);
  }, [categories]);

  // 카테고리 수정
  const handleUpdateCategory = useCallback(
    (id: string, name: string) => {
      setCategories(
        categories.map((cat) => (cat.id === id ? { ...cat, name } : cat))
      );
    },
    [categories]
  );

  // 카테고리 삭제
  const handleDeleteCategory = useCallback(
    (id: string) => {
      setCategories(categories.filter((cat) => cat.id !== id));
      setQAPairs(qaPairs.filter((qa) => qa.categoryId !== id));
      if (selectedCategoryId === id) {
        setSelectedCategoryId(categories.find((c) => c.id !== id)?.id || null);
      }
    },
    [categories, qaPairs, selectedCategoryId]
  );

  // Q&A 추가
  const handleAddQA = useCallback(() => {
    if (!selectedCategoryId) {
      // 카테고리가 없으면 먼저 생성
      const newCategory: Category = {
        id: crypto.randomUUID(),
        name: '일반',
        order: 0,
      };
      setCategories([newCategory]);
      setSelectedCategoryId(newCategory.id);

      const newQA: QAPair = {
        id: crypto.randomUUID(),
        categoryId: newCategory.id,
        question: '',
        answer: '',
        order: 0,
      };
      setQAPairs([newQA]);
      return;
    }

    const categoryQAs = qaPairs.filter(
      (qa) => qa.categoryId === selectedCategoryId
    );
    const newQA: QAPair = {
      id: crypto.randomUUID(),
      categoryId: selectedCategoryId,
      question: '',
      answer: '',
      order: categoryQAs.length,
    };
    setQAPairs([...qaPairs, newQA]);
  }, [selectedCategoryId, qaPairs]);

  // Q&A 수정 (수정 감지 로직 포함)
  const handleUpdateQA = useCallback(
    (id: string, field: 'question' | 'answer', value: string) => {
      setQAPairs(
        qaPairs.map((qa) => {
          if (qa.id !== id) return qa;

          const updated = { ...qa, [field]: value };

          // 잠금 해제 상태에서 원본과 비교하여 수정 여부 감지
          if (!qa.isLocked && qa.originalQuestion !== undefined) {
            const isModified =
              (field === 'question' ? value : qa.question) !== qa.originalQuestion ||
              (field === 'answer' ? value : qa.answer) !== qa.originalAnswer;
            updated.isModified = isModified;
          }

          return updated;
        })
      );
    },
    [qaPairs]
  );

  // Q&A 삭제
  const handleDeleteQA = useCallback(
    (id: string) => {
      setQAPairs(qaPairs.filter((qa) => qa.id !== id));
    },
    [qaPairs]
  );

  // Q&A 문서 업로드
  const handleUploadQA = useCallback(
    async (qaId: string, targetDatasetId?: string) => {
      if (!currentDraftId) {
        // 먼저 초안 저장
        await handleSave();
      }

      const draftId = currentDraftId;
      if (!draftId) {
        toast.warning('저장 필요', { description: 'FAQ를 먼저 저장해주세요.' });
        return;
      }

      // 데이터셋 ID 결정 (전달된 값 우선, 없으면 선택된 값 사용)
      const datasetId = targetDatasetId || selectedDatasetId || undefined;

      setUploadingQAId(qaId);
      try {
        // chatbotId 전달하여 챗봇 연결 데이터셋 사용
        const result = await uploadQAAsDocument(draftId, qaId, datasetId, currentChatbot?.id);
        // 로컬 상태 업데이트
        setQAPairs(
          qaPairs.map((qa) =>
            qa.id === qaId ? result.updatedQAPair : qa
          )
        );
        setLastSaved(new Date());
      } catch (error) {
        console.error('업로드 실패:', error);
        toast.error('업로드 실패', { description: error instanceof Error ? error.message : '업로드에 실패했습니다.' });
      } finally {
        setUploadingQAId(null);
      }
    },
    [currentDraftId, qaPairs, handleSave, selectedDatasetId, currentChatbot?.id]
  );

  // Q&A 잠금 해제
  const handleUnlockQA = useCallback(
    async (qaId: string) => {
      if (!currentDraftId) return;

      try {
        const result = await unlockQA(currentDraftId, qaId);
        // 로컬 상태 업데이트
        setQAPairs(
          qaPairs.map((qa) =>
            qa.id === qaId ? result.updatedQAPair : qa
          )
        );
      } catch (error) {
        console.error('잠금 해제 실패:', error);
        toast.error('잠금 해제 실패', { description: error instanceof Error ? error.message : '잠금 해제에 실패했습니다.' });
      }
    },
    [currentDraftId, qaPairs]
  );

  // 선택된 카테고리의 Q&A 필터링
  const filteredQAPairs = selectedCategoryId
    ? qaPairs.filter((qa) => qa.categoryId === selectedCategoryId)
    : qaPairs;

  // 챗봇 없음 상태
  if (!currentChatbot) {
    return <NoChatbotState />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="border-none bg-transparent text-xl font-bold text-foreground outline-none focus:ring-0"
                placeholder="FAQ 이름"
              />
              <button
                onClick={() => setShowDraftList(!showDraftList)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronDownIcon />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {isSaving
                ? '저장 중...'
                : lastSaved
                  ? `마지막 저장: ${lastSaved.toLocaleTimeString()}`
                  : '자동 저장됨'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNewDraft}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            새 FAQ
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ExportIcon />
            내보내기
          </button>
        </div>
      </div>

      {/* 초안 목록 드롭다운 */}
      {showDraftList && (
        <div className="absolute left-6 top-20 z-20 w-72 rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-2">
            <p className="text-sm font-medium text-foreground">저장된 FAQ</p>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {isLoadingDrafts ? (
              <div className="flex items-center justify-center px-2 py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : drafts.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                저장된 FAQ가 없습니다
              </p>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${
                    currentDraftId === draft.id
                      ? 'bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                >
                  <button
                    onClick={() => handleLoadDraft(draft)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {draft.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {draft.qaPairs.length}개 Q&A · 수정:{' '}
                      {new Date(draft.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDeleteDraft(draft.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 클릭 아웃사이드 오버레이 */}
      {showDraftList && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowDraftList(false)}
        />
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 에디터 */}
        <div className="flex w-1/2 flex-col border-r border-border">
          {/* 카테고리 목록 */}
          <CategoryList
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            onAdd={handleAddCategory}
            onUpdate={handleUpdateCategory}
            onDelete={handleDeleteCategory}
          />

          {/* Q&A 목록 */}
          <QAList
            qaPairs={filteredQAPairs}
            onAdd={handleAddQA}
            onUpdate={handleUpdateQA}
            onDelete={handleDeleteQA}
            onUpload={handleUploadQA}
            onUnlock={handleUnlockQA}
            uploadingQAId={uploadingQAId}
            datasets={datasets}
            selectedDatasetId={selectedDatasetId}
            onDatasetChange={setSelectedDatasetId}
            showDatasetSelector={isAdvancedModeEnabled() && datasets.length > 1}
          />
        </div>

        {/* 우측: 미리보기 */}
        <div className="w-1/2 overflow-y-auto bg-muted/30">
          <FAQPreview categories={categories} qaPairs={qaPairs} />
        </div>
      </div>

      {/* 내보내기 모달 */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        draftId={currentDraftId}
        draftName={draftName}
        categories={categories}
        qaPairs={qaPairs}
        onSave={handleSave}
      />

      {/* 확인 다이얼로그 */}
      {confirmDialog.isOpen && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}

// 확인 다이얼로그 컴포넌트
function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          {message}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// 아이콘 컴포넌트들
function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
