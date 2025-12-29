'use client';

/**
 * FAQ 미리보기 컴포넌트
 * 실시간 Markdown 미리보기 및 품질 요약
 */

import { useMemo } from 'react';
import type { Category, QAPair } from './utils';

interface FAQPreviewProps {
  categories: Category[];
  qaPairs: QAPair[];
}

export function FAQPreview({ categories, qaPairs }: FAQPreviewProps) {
  // 품질 통계 계산
  const stats = useMemo(() => {
    const totalQAs = qaPairs.length;
    if (totalQAs === 0) {
      return {
        totalQAs: 0,
        avgScore: 0,
        autoApprovedCount: 0,
        autoApprovalRate: 0,
      };
    }

    // 개별 점수 계산
    const scores = qaPairs.map((qa) => {
      let score = 50;
      if (qa.question && qa.answer) score += 10;
      const answerLength = qa.answer.length;
      if (answerLength >= 100 && answerLength <= 500) score += 20;
      else if (answerLength > 50 && answerLength < 800) score += 10;
      if (qa.question.trim().endsWith('?')) score += 5;
      if (qa.answer.trim().match(/[.!?]$/)) score += 5;
      return Math.min(100, Math.max(0, score));
    });

    const avgScore = scores.reduce((a, b) => a + b, 0) / totalQAs;
    const autoApprovedCount = scores.filter((s) => s >= 85).length;

    return {
      totalQAs,
      avgScore,
      autoApprovedCount,
      autoApprovalRate: (autoApprovedCount / totalQAs) * 100,
    };
  }, [qaPairs]);

  // Markdown 미리보기 생성
  const markdownPreview = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
    const sections: Array<{
      category: string;
      qaPairs: QAPair[];
    }> = [];

    for (const category of sortedCategories) {
      const categoryQAs = qaPairs
        .filter((qa) => qa.categoryId === category.id)
        .sort((a, b) => a.order - b.order);

      if (categoryQAs.length > 0) {
        sections.push({
          category: category.name,
          qaPairs: categoryQAs,
        });
      }
    }

    // 카테고리 없는 Q&A
    const uncategorizedQAs = qaPairs
      .filter(
        (qa) => !qa.categoryId || !categories.find((c) => c.id === qa.categoryId)
      )
      .sort((a, b) => a.order - b.order);

    if (uncategorizedQAs.length > 0) {
      sections.push({
        category: '기타',
        qaPairs: uncategorizedQAs,
      });
    }

    return sections;
  }, [categories, qaPairs]);

  return (
    <div className="p-6">
      {/* 품질 요약 */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">품질 요약</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="총 Q&A"
            value={stats.totalQAs}
            unit="개"
          />
          <StatCard
            label="평균 품질"
            value={stats.avgScore.toFixed(1)}
            unit="점"
            colorClass={getScoreColor(stats.avgScore)}
          />
          <StatCard
            label="자동 승인"
            value={stats.autoApprovedCount}
            unit="개"
            colorClass="text-green-500"
          />
          <StatCard
            label="승인율"
            value={stats.autoApprovalRate.toFixed(0)}
            unit="%"
            colorClass={stats.autoApprovalRate >= 80 ? 'text-green-500' : 'text-yellow-500'}
          />
        </div>
      </div>

      {/* Markdown 미리보기 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2">
          <h3 className="text-sm font-medium text-foreground">미리보기</h3>
        </div>

        <div className="p-4">
          {markdownPreview.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Q&A를 추가하면 미리보기가 표시됩니다
              </p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <h1 className="text-xl font-bold text-foreground">FAQ 문서</h1>

              {markdownPreview.map((section, sectionIndex) => (
                <div key={sectionIndex} className="mt-6">
                  <h2 className="text-lg font-semibold text-foreground">
                    {section.category}
                  </h2>

                  <div className="mt-3 space-y-4">
                    {section.qaPairs.map((qa, qaIndex) => (
                      <div
                        key={qa.id}
                        className="rounded-md border border-border bg-muted/30 p-3"
                      >
                        <p className="font-medium text-foreground">
                          <span className="text-primary">Q:</span>{' '}
                          {qa.question || (
                            <span className="italic text-muted-foreground">
                              질문을 입력하세요
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-muted-foreground">
                          <span className="text-green-500">A:</span>{' '}
                          {qa.answer || (
                            <span className="italic">답변을 입력하세요</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 팁 */}
      {qaPairs.length > 0 && stats.avgScore < 85 && (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <h4 className="text-sm font-medium text-yellow-500">품질 향상 팁</h4>
          <ul className="mt-2 space-y-1 text-sm text-yellow-500/80">
            {qaPairs.some((qa) => qa.answer.length < 100) && (
              <li>• 답변을 100자 이상으로 작성하면 품질 점수가 올라갑니다</li>
            )}
            {qaPairs.some((qa) => !qa.question.trim().endsWith('?')) && (
              <li>• 질문 끝에 물음표(?)를 추가하세요</li>
            )}
            {qaPairs.some((qa) => !qa.answer.trim().match(/[.!?]$/)) && (
              <li>• 답변을 완전한 문장으로 마무리하세요 (마침표, 느낌표 등)</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  unit: string;
  colorClass?: string;
}

function StatCard({ label, value, unit, colorClass }: StatCardProps) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${colorClass || 'text-foreground'}`}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-destructive';
}
