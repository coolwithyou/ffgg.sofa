'use client';

/**
 * 데이터 무결성 경고 배너
 * 청크 데이터의 무결성 이슈를 시각적으로 표시하고 수정 기능 제공
 */

import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Wrench, Loader2 } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';

export interface IntegrityIssues {
  emptyContent: number;
  missingEmbedding: number;
  missingDatasetId: number; // 검색에서 제외되는 청크 (datasetId 누락/불일치)
  duplicateContent: number;
  unscored: number;
}

interface AffectedChunk {
  id: string;
  document_id: string;
  filename: string;
  content_preview?: string;
  status: string;
  is_active: boolean;
  chunk_dataset_id?: string | null;
  doc_dataset_id?: string;
}

interface IntegrityAlertBannerProps {
  issues: IntegrityIssues;
  totalChunks: number;
  datasetId: string;
  onFixed?: () => void; // 수정 후 새로고침을 위한 콜백
}

type IssueType = 'missingDatasetId' | 'missingEmbedding' | 'emptyContent';

export function IntegrityAlertBanner({
  issues,
  totalChunks,
  datasetId,
  onFixed,
}: IntegrityAlertBannerProps) {
  const [expandedIssue, setExpandedIssue] = useState<IssueType | null>(null);
  const [affectedChunks, setAffectedChunks] = useState<AffectedChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);
  const { confirm } = useAlertDialog();

  const issueItems: {
    key: keyof IntegrityIssues;
    label: string;
    severity: 'error' | 'warning' | 'info';
    fixable?: boolean;
    fixAction?: 'fixDatasetId' | 'fixMissingEmbedding';
    apiType?: IssueType;
  }[] = [
    { key: 'emptyContent', label: '빈 콘텐츠', severity: 'error', apiType: 'emptyContent' },
    {
      key: 'missingEmbedding',
      label: '임베딩 누락',
      severity: 'warning',
      fixable: true,
      fixAction: 'fixMissingEmbedding',
      apiType: 'missingEmbedding',
    },
    {
      key: 'missingDatasetId',
      label: '검색 제외 (datasetId 누락)',
      severity: 'error',
      fixable: true,
      fixAction: 'fixDatasetId',
      apiType: 'missingDatasetId',
    },
    { key: 'duplicateContent', label: '중복 콘텐츠', severity: 'info' },
    { key: 'unscored', label: '미평가', severity: 'info' },
  ];

  const activeIssues = issueItems.filter((item) => issues[item.key] > 0);

  if (activeIssues.length === 0) {
    return null;
  }

  const hasError = activeIssues.some((item) => item.severity === 'error');
  const hasWarning = activeIssues.some((item) => item.severity === 'warning');

  const bannerClass = hasError
    ? 'border-destructive/30 bg-destructive/5'
    : hasWarning
      ? 'border-yellow-500/30 bg-yellow-500/5'
      : 'border-primary/30 bg-primary/5';

  const IconComponent = hasError ? AlertCircle : hasWarning ? AlertTriangle : Info;
  const iconClass = hasError
    ? 'text-destructive'
    : hasWarning
      ? 'text-yellow-500'
      : 'text-primary';

  const fetchAffectedChunks = async (issueType: IssueType) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/integrity?type=${issueType}&limit=20`);
      const data = await res.json();
      setAffectedChunks(data.chunks || []);
    } catch (error) {
      console.error('Failed to fetch affected chunks:', error);
      setAffectedChunks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpand = async (issueType: IssueType) => {
    if (expandedIssue === issueType) {
      setExpandedIssue(null);
      setAffectedChunks([]);
    } else {
      setExpandedIssue(issueType);
      await fetchAffectedChunks(issueType);
    }
  };

  const handleFix = async (action: 'fixDatasetId' | 'fixMissingEmbedding') => {
    const confirmConfig = {
      fixDatasetId: {
        title: 'datasetId 동기화',
        message: 'datasetId를 동기화하시겠습니까? 이 작업은 청크의 datasetId를 문서의 datasetId로 업데이트합니다.',
      },
      fixMissingEmbedding: {
        title: '임베딩 재생성',
        message: '임베딩을 재생성하시겠습니까? 누락된 임베딩이 있는 청크에 대해 임베딩을 생성합니다. 청크 수에 따라 시간이 걸릴 수 있습니다.',
      },
    };

    const confirmed = await confirm({
      title: confirmConfig[action].title,
      message: confirmConfig[action].message,
      confirmText: '수정',
      cancelText: '취소',
    });

    if (!confirmed) {
      return;
    }

    setIsFixing(true);
    setFixResult(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/integrity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'fixMissingEmbedding') {
          const failedInfo = data.failedRows > 0 ? ` (실패: ${data.failedRows}개)` : '';
          setFixResult(`✅ ${data.affectedRows}개 청크에 임베딩이 생성되었습니다${failedInfo}`);
        } else {
          setFixResult(`✅ ${data.affectedRows}개 청크가 수정되었습니다.`);
        }
        onFixed?.();
      } else {
        setFixResult(`❌ 오류: ${data.error}`);
      }
    } catch (error) {
      setFixResult('❌ 수정 중 오류가 발생했습니다.');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${bannerClass}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`h-5 w-5 flex-shrink-0 ${iconClass}`} />
        <div className="flex-1 space-y-3">
          <h4 className="font-medium text-foreground">데이터 무결성 확인 필요</h4>

          <div className="space-y-2">
            {activeIssues.map((item) => {
              const count = issues[item.key];
              const percent = totalChunks > 0 ? Math.round((count / totalChunks) * 100) : 0;
              const isExpanded = expandedIssue === item.apiType;

              const itemClass =
                item.severity === 'error'
                  ? 'text-destructive'
                  : item.severity === 'warning'
                    ? 'text-yellow-600 dark:text-yellow-500'
                    : 'text-muted-foreground';

              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 text-sm ${itemClass}`}>
                      <span>{item.label}:</span>
                      <span className="font-medium">{count}개</span>
                      <span className="text-muted-foreground">({percent}%)</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {item.fixable && item.fixAction && issues[item.key] > 0 && (
                        <button
                          onClick={() => handleFix(item.fixAction!)}
                          disabled={isFixing}
                          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isFixing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                          수정
                        </button>
                      )}

                      {item.apiType && (
                        <button
                          onClick={() => handleToggleExpand(item.apiType!)}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              접기
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              상세
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 확장된 청크 목록 */}
                  {isExpanded && (
                    <div className="rounded-md border border-border bg-card p-3">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : affectedChunks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">해당하는 청크가 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {affectedChunks.length}개 청크 표시 (최대 20개)
                          </p>
                          <div className="max-h-60 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="border-b border-border">
                                <tr>
                                  <th className="py-1 text-left font-medium text-muted-foreground">
                                    파일명
                                  </th>
                                  <th className="py-1 text-left font-medium text-muted-foreground">
                                    상태
                                  </th>
                                  <th className="py-1 text-left font-medium text-muted-foreground">
                                    내용 미리보기
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {affectedChunks.map((chunk) => (
                                  <tr key={chunk.id}>
                                    <td className="py-1.5 pr-2 text-foreground">
                                      {chunk.filename}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      <span
                                        className={`inline-block rounded px-1.5 py-0.5 ${
                                          chunk.status === 'approved'
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                      >
                                        {chunk.status}
                                      </span>
                                    </td>
                                    <td className="max-w-xs truncate py-1.5 text-muted-foreground">
                                      {chunk.content_preview || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {fixResult && (
            <p className="text-sm font-medium">{fixResult}</p>
          )}

          {!fixResult && (hasError || hasWarning) && (
            <p className="text-sm text-muted-foreground">
              {issues.missingDatasetId > 0
                ? 'datasetId가 누락된 청크는 검색에서 완전히 제외됩니다. "수정" 버튼을 클릭하여 동기화하세요.'
                : issues.missingEmbedding > 0
                  ? '임베딩이 누락된 청크는 Dense/Hybrid 검색에서 제외됩니다. "수정" 버튼을 클릭하여 임베딩을 재생성하세요.'
                  : '빈 콘텐츠 청크는 검색 및 RAG 응답에 영향을 줄 수 있습니다. 해당 청크를 확인해주세요.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
