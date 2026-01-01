'use client';

/**
 * 데이터 무결성 경고 배너
 * 청크 데이터의 무결성 이슈를 시각적으로 표시
 */

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface IntegrityIssues {
  emptyContent: number;
  missingEmbedding: number;
  missingTsv: number;
  duplicateContent: number;
  unscored: number;
}

interface IntegrityAlertBannerProps {
  issues: IntegrityIssues;
  totalChunks: number;
}

export function IntegrityAlertBanner({ issues, totalChunks }: IntegrityAlertBannerProps) {
  const issueItems: { key: keyof IntegrityIssues; label: string; severity: 'error' | 'warning' | 'info' }[] = [
    { key: 'emptyContent', label: '빈 콘텐츠', severity: 'error' },
    { key: 'missingEmbedding', label: '임베딩 누락', severity: 'warning' },
    { key: 'missingTsv', label: 'TSV 누락', severity: 'warning' },
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

  return (
    <div className={`rounded-lg border p-4 ${bannerClass}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`h-5 w-5 flex-shrink-0 ${iconClass}`} />
        <div className="flex-1 space-y-2">
          <h4 className="font-medium text-foreground">데이터 무결성 확인 필요</h4>
          <div className="flex flex-wrap gap-3 text-sm">
            {activeIssues.map((item) => {
              const count = issues[item.key];
              const percent = totalChunks > 0 ? Math.round((count / totalChunks) * 100) : 0;

              const itemClass =
                item.severity === 'error'
                  ? 'text-destructive'
                  : item.severity === 'warning'
                    ? 'text-yellow-600 dark:text-yellow-500'
                    : 'text-muted-foreground';

              return (
                <span key={item.key} className={`flex items-center gap-1.5 ${itemClass}`}>
                  <span>{item.label}:</span>
                  <span className="font-medium">{count}개</span>
                  <span className="text-muted-foreground">({percent}%)</span>
                </span>
              );
            })}
          </div>
          {hasError && (
            <p className="text-sm text-muted-foreground">
              빈 콘텐츠 청크는 검색 및 RAG 응답에 영향을 줄 수 있습니다. 해당 청크를 확인해주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
