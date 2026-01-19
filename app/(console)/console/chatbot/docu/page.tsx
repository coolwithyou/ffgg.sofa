'use client';

/**
 * Knowledge 페이지 (문서 + 라이브러리 통합)
 * 탭으로 문서/라이브러리 전환
 *
 * 챗봇별 데이터 격리: 현재 선택된 챗봇에 연결된 데이터셋의 문서만 표시
 */

import { useState, useEffect } from 'react';
import { DocumentList } from './_components/document-list';
import { DocumentUpload } from './_components/document-upload';
import { LibraryDocumentList } from './_components/library-document-list';
import { UploadGuide } from './_components/upload-guide';
import { TemplateDownload } from './_components/template-download';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { NoChatbotState } from '../../components/no-chatbot-state';
import {
  getDocuments,
  getLibraryDocuments,
  getDatasets,
  type GetDocumentsResult,
  type LibraryDocument,
  type DatasetOption,
} from './actions';

type TabType = 'documents' | 'library';

export default function KnowledgePage() {
  const { currentChatbot } = useCurrentChatbot();
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [isLoading, setIsLoading] = useState(true);

  // Documents tab data
  const [documentsData, setDocumentsData] = useState<GetDocumentsResult | null>(null);

  // Library tab data
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([]);
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);

  // 초기 데이터 로딩 (챗봇 변경 시 재로딩)
  useEffect(() => {
    if (!currentChatbot?.id) return;

    async function loadInitialData() {
      setIsLoading(true);
      try {
        const chatbotId = currentChatbot!.id;
        const [docsResult, libDocs, dsOptions] = await Promise.all([
          getDocuments(chatbotId, 1, 10),
          getLibraryDocuments(chatbotId),
          getDatasets(chatbotId),
        ]);
        setDocumentsData(docsResult);
        setLibraryDocuments(libDocs);
        setDatasets(dsOptions);
      } catch (error) {
        console.error('Failed to load knowledge data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, [currentChatbot?.id]);

  // 데이터 새로고침
  const refreshData = async () => {
    if (!currentChatbot?.id) return;

    try {
      const chatbotId = currentChatbot.id;
      const [docsResult, libDocs, dsOptions] = await Promise.all([
        getDocuments(chatbotId, 1, 10),
        getLibraryDocuments(chatbotId),
        getDatasets(chatbotId),
      ]);
      setDocumentsData(docsResult);
      setLibraryDocuments(libDocs);
      setDatasets(dsOptions);
    } catch (error) {
      console.error('Failed to refresh knowledge data:', error);
    }
  };

  // 챗봇 없음 상태 (모든 훅 호출 후 체크)
  if (!currentChatbot) {
    return <NoChatbotState />;
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">지식 관리</h1>
        <p className="mt-1 text-muted-foreground">
          문서를 업로드하고 데이터셋으로 관리하세요
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4">
          <TabButton
            label="문서"
            count={documentsData?.pagination.total || 0}
            isActive={activeTab === 'documents'}
            onClick={() => setActiveTab('documents')}
          />
          <TabButton
            label="라이브러리"
            count={libraryDocuments.length}
            isActive={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
          />
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'documents' && documentsData && (
        <DocumentsTab initialData={documentsData} />
      )}

      {activeTab === 'library' && (
        <LibraryTab documents={libraryDocuments} datasets={datasets} />
      )}
    </div>
  );
}

// 탭 버튼 컴포넌트
function TabButton({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
        isActive
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// 문서 탭 콘텐츠
function DocumentsTab({
  initialData,
}: {
  initialData: GetDocumentsResult;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 좌측: 업로드 & 가이드 */}
      <div className="space-y-6 lg:col-span-1">
        <DocumentUpload />
        <UploadGuide />
        <TemplateDownload />
      </div>

      {/* 우측: 문서 목록 */}
      <div className="lg:col-span-2">
        <DocumentList initialData={initialData} />
      </div>
    </div>
  );
}

// 라이브러리 탭 콘텐츠
function LibraryTab({
  documents,
  datasets,
}: {
  documents: LibraryDocument[];
  datasets: DatasetOption[];
}) {
  return (
    <div>
      {/* 라이브러리 설명 */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div>
            <h3 className="font-medium text-foreground">라이브러리란?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              라이브러리는 아직 데이터셋에 배치되지 않은 문서들의 저장소입니다.
              문서를 데이터셋에 이동하거나 복제하여 챗봇 검색에 활용할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 문서 목록 + 맵핑 패널 */}
      <LibraryDocumentList documents={documents} datasets={datasets} />
    </div>
  );
}

// 아이콘 컴포넌트
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
