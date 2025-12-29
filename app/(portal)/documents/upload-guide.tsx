'use client';

/**
 * 업로드 가이드 컴포넌트
 * 고품질 학습 데이터 작성을 위한 가이드라인 제공
 */

import { useState } from 'react';

interface Guideline {
  title: string;
  tip: string;
  example: string;
  bonus?: string;
}

const GUIDELINES: Guideline[] = [
  {
    title: 'Q&A 형식 사용',
    tip: '"Q:" 또는 "질문:"으로 시작하고, "A:" 또는 "답변:"으로 답변을 작성하세요.',
    example: 'Q: 배송은 얼마나 걸리나요?\nA: 주문 후 영업일 기준 2~3일 이내 배송됩니다.',
    bonus: '+10점 품질 가산점',
  },
  {
    title: 'Markdown 헤더로 카테고리 구분',
    tip: '"#" 또는 "##"으로 카테고리를 구분하면 문서 구조가 명확해집니다.',
    example: '## 배송 문의\n\nQ: 배송비는 얼마인가요?\nA: 30,000원 이상 구매 시 무료입니다.',
    bonus: '+5점 품질 가산점',
  },
  {
    title: '적정 길이 유지',
    tip: '각 답변은 100~800자 사이가 최적입니다. 너무 짧거나 긴 답변은 품질 점수가 낮아집니다.',
    example: '간결하면서도 충분한 정보를 제공하는 답변이 좋습니다.',
    bonus: '자동 승인 가능 (85점 이상)',
  },
  {
    title: '완전한 문장으로 작성',
    tip: '답변은 마침표(.)로 끝나는 완전한 문장으로 작성하세요.',
    example: '❌ "2~3일"\n✅ "주문 후 영업일 기준 2~3일 이내 배송됩니다."',
  },
];

export function UploadGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LightbulbIcon />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">고품질 데이터 작성 가이드</h2>
            <p className="text-sm text-muted-foreground">
              이 가이드를 따르면 더 높은 품질 점수를 받을 수 있습니다.
            </p>
          </div>
        </div>
        <ChevronIcon isExpanded={isExpanded} />
      </button>

      {isExpanded && (
        <div className="border-t border-border px-6 pb-6">
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {GUIDELINES.map((guideline, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-foreground">{guideline.title}</h3>
                  {guideline.bonus && (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                      {guideline.bonus}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{guideline.tip}</p>
                <div className="mt-3 rounded-md bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">예시</p>
                  <pre className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {guideline.example}
                  </pre>
                </div>
              </div>
            ))}
          </div>

          {/* 지원 파일 형식 */}
          <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="font-medium text-foreground">지원 파일 형식</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { ext: 'MD', desc: 'Markdown (권장)' },
                { ext: 'TXT', desc: '텍스트' },
                { ext: 'CSV', desc: '스프레드시트' },
                { ext: 'PDF', desc: 'PDF 문서' },
                { ext: 'DOCX', desc: 'Word 문서' },
                { ext: 'JSON', desc: 'JSON 데이터' },
              ].map((format) => (
                <span
                  key={format.ext}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  <span className="font-medium text-foreground">{format.ext}</span>
                  <span className="text-muted-foreground">- {format.desc}</span>
                </span>
              ))}
            </div>
          </div>

          {/* 품질 점수 설명 */}
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <InfoIcon />
            <div className="text-sm">
              <p className="font-medium text-foreground">품질 점수란?</p>
              <p className="mt-1 text-muted-foreground">
                업로드된 문서는 자동으로 청크(작은 단위)로 분리되며, 각 청크에 0~100점의 품질 점수가 부여됩니다.{' '}
                <strong className="text-foreground">85점 이상</strong>인 청크는 자동 승인되어 바로 챗봇에 반영됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 아이콘 컴포넌트들
function LightbulbIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 text-muted-foreground transition-transform ${
        isExpanded ? 'rotate-180' : ''
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-primary"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
