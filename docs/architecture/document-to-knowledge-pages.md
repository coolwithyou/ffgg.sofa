# 문서 → Knowledge Pages 자동 변환 구현 설계

## 개요

업로드된 문서(PDF, DOCX 등)를 LLM을 사용하여 계층적인 Knowledge Pages 구조로 자동 변환하는 기능을 구현합니다.

**핵심 원칙**: "청크가 아니라 페이지다"
- 블랙박스 청크 대신 사람이 읽고 검수할 수 있는 구조화된 페이지 생성
- 각 페이지는 독립적으로 이해 가능하고, 200-800 단어가 적절

---

## 시스템 아키텍처

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          문서 → Knowledge Pages 변환 흐름                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [문서 목록 UI]                                                             │
│       │                                                                    │
│       ▼                                                                    │
│  "Knowledge Pages로 변환" 버튼 클릭                                         │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────┐                              │
│  │  Inngest Event: document/convert-to-pages│                              │
│  │  { documentId, chatbotId, options }      │                              │
│  └─────────────────────────────────────────┘                              │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────┐                              │
│  │  Step 1: 문서 텍스트 추출                 │                              │
│  │  - S3에서 파일 다운로드                   │                              │
│  │  - PDF/DOCX 파싱 (기존 로직 재사용)       │                              │
│  └─────────────────────────────────────────┘                              │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────┐                              │
│  │  Step 2: LLM 구조 분석                    │                              │
│  │  - Claude로 문서 구조 파악                │                              │
│  │  - 페이지 트리 JSON 생성                  │                              │
│  │  - 각 페이지별 source_pages, 요약 포함    │                              │
│  └─────────────────────────────────────────┘                              │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────┐                              │
│  │  Step 3: 페이지별 콘텐츠 생성             │                              │
│  │  - 각 페이지에 대해 LLM 호출              │                              │
│  │  - 마크다운 형식으로 변환                 │                              │
│  │  - 원본 정보 보존 (숫자, 연락처 등)       │                              │
│  └─────────────────────────────────────────┘                              │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────┐                              │
│  │  Step 4: Knowledge Pages DB 저장         │                              │
│  │  - createKnowledgePage() 호출            │                              │
│  │  - status: 'draft' (검토 필요)           │                              │
│  │  - sourceDocumentId 연결                 │                              │
│  └─────────────────────────────────────────┘                              │
│       │                                                                    │
│       ▼                                                                    │
│  [Knowledge Pages UI에서 검토/수정/발행]                                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 파일 구조

```
lib/knowledge-pages/
├── document-to-pages.ts       # 변환 파이프라인 메인 로직
├── prompts/
│   ├── structure-analysis.ts  # 구조 분석 프롬프트
│   └── content-generation.ts  # 콘텐츠 생성 프롬프트
└── types.ts                   # 타입 정의

inngest/functions/
└── convert-document-to-pages.ts  # Inngest 이벤트 핸들러

app/api/documents/convert-to-pages/
└── route.ts                   # API 엔드포인트

app/(console)/console/chatbot/documents/
└── _components/
    └── convert-to-pages-button.tsx  # 변환 버튼 컴포넌트
```

---

## 핵심 타입 정의

```typescript
// lib/knowledge-pages/types.ts

/**
 * LLM 구조 분석 결과
 */
export interface DocumentStructure {
  title: string;
  pages: PageNode[];
}

export interface PageNode {
  id: string;                    // 슬러그 형태 (예: "installation")
  title: string;                 // 페이지 제목
  sourcePages: number[];         // 원본 문서 페이지 번호
  contentSummary: string;        // 이 페이지가 다루는 내용 요약
  children: PageNode[];          // 하위 페이지
}

/**
 * 콘텐츠 생성 결과
 */
export interface GeneratedPage {
  id: string;
  title: string;
  content: string;               // 마크다운 콘텐츠
  sourcePages: number[];
  confidence: number;            // AI 변환 신뢰도 (0-1)
  children: GeneratedPage[];
}

/**
 * 변환 옵션
 */
export interface ConversionOptions {
  chatbotId: string;
  parentPageId?: string;         // 특정 페이지 하위에 생성할 경우
  minPageWords?: number;         // 최소 단어 수 (기본: 100)
  maxPageWords?: number;         // 최대 단어 수 (기본: 800)
  preserveDocumentTitle?: boolean; // 문서 제목을 루트 페이지로 사용
}

/**
 * 변환 진행 상태 (프로그레스 표시용)
 */
export interface ConversionProgress {
  status: 'parsing' | 'analyzing' | 'generating' | 'saving' | 'completed' | 'failed';
  currentStep: string;
  totalPages: number;
  completedPages: number;
  error?: string;
}
```

---

## LLM 프롬프트 설계

### 1. 구조 분석 프롬프트

```typescript
// lib/knowledge-pages/prompts/structure-analysis.ts

export const STRUCTURE_ANALYSIS_SYSTEM_PROMPT = `당신은 문서 구조화 전문가입니다.
주어진 문서를 계층적인 "지식 페이지" 구조로 분해하세요.

## 목표
- 각 페이지는 하나의 명확한 주제를 다룹니다
- 페이지는 폴더처럼 계층 구조를 가질 수 있습니다
- 각 페이지는 독립적으로 이해 가능해야 합니다
- FAQ, 테이블, 연락처 목록 등은 자연스러운 단위로 그룹화

## 페이지 크기 가이드라인
- 너무 짧음: 100단어 미만 → 다른 페이지와 합치기
- 적절함: 200~800단어
- 너무 김: 1000단어 초과 → 하위 페이지로 분리

## id 네이밍 규칙
- 영문 소문자와 하이픈만 사용 (예: "quick-start", "system-requirements")
- 한글 제목이라도 id는 영문으로 (예: "company-intro" for "회사 소개")

## 출력 형식
JSON만 출력하세요. 설명이나 마크다운 코드 블록 없이 순수 JSON만 반환합니다.`;

export const STRUCTURE_ANALYSIS_USER_PROMPT = (documentText: string) => `
아래 문서를 분석하여 페이지 트리 구조를 JSON으로 출력하세요.

## 문서 내용

${documentText}

## 출력 예시

{
  "title": "문서 전체 제목",
  "pages": [
    {
      "id": "overview",
      "title": "개요",
      "sourcePages": [1, 2],
      "contentSummary": "이 문서가 다루는 내용 요약",
      "children": []
    },
    {
      "id": "installation",
      "title": "설치 가이드",
      "sourcePages": [3],
      "contentSummary": "설치 방법 안내",
      "children": [
        {
          "id": "requirements",
          "title": "시스템 요구사항",
          "sourcePages": [3, 4],
          "contentSummary": "필요한 시스템 사양",
          "children": []
        }
      ]
    }
  ]
}`;
```

### 2. 콘텐츠 생성 프롬프트

```typescript
// lib/knowledge-pages/prompts/content-generation.ts

export const CONTENT_GENERATION_SYSTEM_PROMPT = `당신은 기술 문서 작성 전문가입니다.
주어진 원문을 깔끔한 마크다운 페이지로 변환하세요.

## 작성 원칙
1. 원문의 모든 정보를 포함하세요 (누락 금지)
2. 구조화된 마크다운을 사용하세요 (헤더, 리스트, 테이블)
3. 원문에 없는 정보를 추가하지 마세요
4. 연락처, 숫자, 날짜는 원문 그대로 유지하세요
5. 코드나 명령어는 코드 블록으로 감싸세요

## 마크다운 형식
- # 제목은 사용하지 마세요 (별도 title 필드 사용)
- ## 부터 시작하여 섹션 구분
- 목록은 - 또는 1. 사용
- 표는 | 구문 사용
- 중요 내용은 **굵게** 또는 > 인용구 사용`;

export const CONTENT_GENERATION_USER_PROMPT = (
  title: string,
  breadcrumb: string,
  contentSummary: string,
  sourceText: string,
  sourcePages: number[]
) => `
## 페이지 정보
- 제목: ${title}
- 상위 경로: ${breadcrumb}
- 이 페이지의 역할: ${contentSummary}
- 원본 위치: ${sourcePages.join(', ')}페이지

## 원문

${sourceText}

## 지시사항
위 원문을 기반으로 "${title}" 페이지의 마크다운 콘텐츠를 작성하세요.
마크다운 콘텐츠만 출력하고, 설명이나 코드 블록 표시 없이 내용만 반환합니다.`;
```

---

## 변환 파이프라인 구현

```typescript
// lib/knowledge-pages/document-to-pages.ts

import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { createKnowledgePage } from '@/app/(console)/console/chatbot/blog/actions';
import {
  STRUCTURE_ANALYSIS_SYSTEM_PROMPT,
  STRUCTURE_ANALYSIS_USER_PROMPT,
} from './prompts/structure-analysis';
import {
  CONTENT_GENERATION_SYSTEM_PROMPT,
  CONTENT_GENERATION_USER_PROMPT,
} from './prompts/content-generation';
import type {
  DocumentStructure,
  PageNode,
  GeneratedPage,
  ConversionOptions,
  ConversionProgress,
} from './types';

/**
 * 문서 → Knowledge Pages 변환 메인 함수
 */
export async function convertDocumentToPages(
  documentText: string,
  options: ConversionOptions,
  onProgress?: (progress: ConversionProgress) => void
): Promise<GeneratedPage[]> {
  const {
    chatbotId,
    parentPageId,
    minPageWords = 100,
    maxPageWords = 800,
  } = options;

  // Step 1: 구조 분석
  onProgress?.({
    status: 'analyzing',
    currentStep: '문서 구조 분석 중...',
    totalPages: 0,
    completedPages: 0,
  });

  const structure = await analyzeDocumentStructure(documentText);
  const totalPages = countPages(structure.pages);

  // Step 2: 페이지별 콘텐츠 생성
  onProgress?.({
    status: 'generating',
    currentStep: '페이지 콘텐츠 생성 중...',
    totalPages,
    completedPages: 0,
  });

  let completedPages = 0;
  const generatedPages = await generatePagesContent(
    structure.pages,
    documentText,
    '',
    () => {
      completedPages++;
      onProgress?.({
        status: 'generating',
        currentStep: `페이지 생성 중 (${completedPages}/${totalPages})`,
        totalPages,
        completedPages,
      });
    }
  );

  // Step 3: Knowledge Pages DB 저장
  onProgress?.({
    status: 'saving',
    currentStep: 'Knowledge Pages 저장 중...',
    totalPages,
    completedPages: totalPages,
  });

  await savePagesToDatabase(generatedPages, chatbotId, parentPageId);

  onProgress?.({
    status: 'completed',
    currentStep: '변환 완료',
    totalPages,
    completedPages: totalPages,
  });

  return generatedPages;
}

/**
 * Step 1: LLM으로 문서 구조 분석
 */
async function analyzeDocumentStructure(documentText: string): Promise<DocumentStructure> {
  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-latest'),
    system: STRUCTURE_ANALYSIS_SYSTEM_PROMPT,
    prompt: STRUCTURE_ANALYSIS_USER_PROMPT(documentText),
    maxTokens: 4096,
  });

  // JSON 파싱 (코드 블록 제거)
  const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
  const structure = JSON.parse(cleanJson) as DocumentStructure;

  return structure;
}

/**
 * Step 2: 페이지별 콘텐츠 생성 (재귀)
 */
async function generatePagesContent(
  nodes: PageNode[],
  fullDocumentText: string,
  breadcrumb: string,
  onPageComplete: () => void
): Promise<GeneratedPage[]> {
  const results: GeneratedPage[] = [];

  for (const node of nodes) {
    const currentBreadcrumb = breadcrumb
      ? `${breadcrumb} > ${node.title}`
      : node.title;

    // 해당 페이지의 소스 텍스트 추출 (페이지 번호 기반)
    // 실제 구현에서는 PDF 페이지 매핑이 필요
    const sourceText = extractSourceText(fullDocumentText, node.sourcePages);

    // LLM으로 콘텐츠 생성
    const { text } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      system: CONTENT_GENERATION_SYSTEM_PROMPT,
      prompt: CONTENT_GENERATION_USER_PROMPT(
        node.title,
        currentBreadcrumb,
        node.contentSummary,
        sourceText,
        node.sourcePages
      ),
      maxTokens: 4096,
    });

    // 마크다운 코드 블록 제거
    const content = text.replace(/```markdown\n?|\n?```/g, '').trim();

    // 하위 페이지 재귀 처리
    const children = node.children.length > 0
      ? await generatePagesContent(
          node.children,
          fullDocumentText,
          currentBreadcrumb,
          onPageComplete
        )
      : [];

    results.push({
      id: node.id,
      title: node.title,
      content,
      sourcePages: node.sourcePages,
      confidence: 0.85, // TODO: 실제 신뢰도 계산
      children,
    });

    onPageComplete();
  }

  return results;
}

/**
 * Step 3: Knowledge Pages DB 저장 (재귀)
 */
async function savePagesToDatabase(
  pages: GeneratedPage[],
  chatbotId: string,
  parentId: string | null
): Promise<void> {
  for (const page of pages) {
    const result = await createKnowledgePage({
      chatbotId,
      parentId,
      title: page.title,
      content: page.content,
    });

    if (result.success && result.page && page.children.length > 0) {
      // 하위 페이지 재귀 저장
      await savePagesToDatabase(page.children, chatbotId, result.page.id);
    }
  }
}

/**
 * 헬퍼: 전체 페이지 수 계산
 */
function countPages(nodes: PageNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + countPages(node.children),
    0
  );
}

/**
 * 헬퍼: 소스 텍스트 추출 (간단 구현)
 * TODO: 실제 PDF 페이지 매핑 구현 필요
 */
function extractSourceText(fullText: string, sourcePages: number[]): string {
  // MVP에서는 전체 텍스트 반환, 추후 페이지 매핑 구현
  return fullText;
}
```

---

## Inngest 이벤트 핸들러

```typescript
// inngest/functions/convert-document-to-pages.ts

import { inngest } from '@/inngest/client';
import { db, documents } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getFileContent } from '@/lib/storage';
import { parseDocument } from '@/lib/document-parser';
import { convertDocumentToPages } from '@/lib/knowledge-pages/document-to-pages';

export const convertDocumentToPagesFunction = inngest.createFunction(
  {
    id: 'convert-document-to-pages',
    retries: 2,
  },
  { event: 'document/convert-to-pages' },
  async ({ event, step }) => {
    const { documentId, chatbotId, tenantId, options } = event.data;

    // Step 1: 문서 로드
    const document = await step.run('load-document', async () => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc) {
        throw new Error('문서를 찾을 수 없습니다.');
      }

      return doc;
    });

    // Step 2: 파일 다운로드 및 파싱
    const documentText = await step.run('parse-document', async () => {
      const fileContent = await getFileContent(document.fileKey);
      const parsed = await parseDocument(fileContent, document.fileType);
      return parsed.text;
    });

    // Step 3: Knowledge Pages로 변환
    const pages = await step.run('convert-to-pages', async () => {
      return convertDocumentToPages(documentText, {
        chatbotId,
        ...options,
      });
    });

    // Step 4: 문서 상태 업데이트
    await step.run('update-document-status', async () => {
      await db
        .update(documents)
        .set({
          convertedToPages: true,
          convertedAt: new Date(),
          convertedPageCount: countAllPages(pages),
        })
        .where(eq(documents.id, documentId));
    });

    return {
      success: true,
      documentId,
      pageCount: countAllPages(pages),
    };
  }
);

function countAllPages(pages: any[]): number {
  return pages.reduce(
    (sum, page) => sum + 1 + countAllPages(page.children || []),
    0
  );
}
```

---

## API 엔드포인트

```typescript
// app/api/documents/convert-to-pages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { inngest } from '@/inngest/client';
import { db, documents } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.tenantId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { documentId, chatbotId, options } = await request.json();

  // 문서 소유권 확인
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.tenantId, session.tenantId)
      )
    )
    .limit(1);

  if (!document) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Inngest 이벤트 발행
  await inngest.send({
    name: 'document/convert-to-pages',
    data: {
      documentId,
      chatbotId,
      tenantId: session.tenantId,
      options,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Knowledge Pages 변환이 시작되었습니다.',
  });
}
```

---

## UI 컴포넌트

### 변환 버튼

```tsx
// app/(console)/console/chatbot/documents/_components/convert-to-pages-button.tsx

'use client';

import { useState } from 'react';
import { FileStack, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ConvertToPagesButtonProps {
  documentId: string;
  chatbotId: string;
  documentName: string;
  disabled?: boolean;
}

export function ConvertToPagesButton({
  documentId,
  chatbotId,
  documentName,
  disabled,
}: ConvertToPagesButtonProps) {
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    setIsConverting(true);

    try {
      const response = await fetch('/api/documents/convert-to-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, chatbotId }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Knowledge Pages 변환이 시작되었습니다.', {
          description: '완료되면 블로그 메뉴에서 확인할 수 있습니다.',
        });
      } else {
        toast.error(result.error || '변환 시작에 실패했습니다.');
      }
    } catch (error) {
      toast.error('변환 요청 중 오류가 발생했습니다.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleConvert}
      disabled={disabled || isConverting}
    >
      {isConverting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          변환 중...
        </>
      ) : (
        <>
          <FileStack className="mr-2 h-4 w-4" />
          페이지로 변환
        </>
      )}
    </Button>
  );
}
```

---

## 구현 순서

### Phase 1: 기반 구축 (1-2일)

1. [ ] 타입 정의 (`lib/knowledge-pages/types.ts`)
2. [ ] 프롬프트 작성 (`lib/knowledge-pages/prompts/`)
3. [ ] 변환 파이프라인 (`lib/knowledge-pages/document-to-pages.ts`)
4. [ ] 단위 테스트 (프롬프트 검증)

### Phase 2: 통합 (1-2일)

5. [ ] Inngest 핸들러 (`inngest/functions/convert-document-to-pages.ts`)
6. [ ] API 엔드포인트 (`app/api/documents/convert-to-pages/route.ts`)
7. [ ] DB 스키마 확장 (documents 테이블에 convertedToPages 필드)

### Phase 3: UI (1일)

8. [ ] 변환 버튼 컴포넌트
9. [ ] 문서 목록에 버튼 추가
10. [ ] 변환 진행 상태 표시 (선택)

### Phase 4: 테스트 (1일)

11. [ ] 실제 PDF 문서로 E2E 테스트
12. [ ] 에러 케이스 처리
13. [ ] 변환 결과 품질 검토

---

## 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응책 |
|--------|------|------|--------|
| LLM 구조 분석 실패 | Medium | High | JSON 파싱 실패 시 단순 분할 폴백 |
| 페이지 수가 너무 많음 | Medium | Medium | maxPages 제한 + 경고 |
| 토큰 비용 초과 | Low | Medium | Haiku 사용 + 캐싱 |
| 원본 정보 손실 | Medium | High | 숫자/연락처 검증 로직 추가 |

---

## 성공 기준

| 기준 | 목표 |
|------|------|
| 변환 성공률 | 90% 이상 |
| 평균 변환 시간 | 10페이지 문서 기준 30초 이내 |
| 콘텐츠 정확도 | 원본 대비 95% 이상 정보 보존 |
| 사용자 수정률 | 변환 후 수정 없이 발행 50% 이상 |

---

*작성일: 2026-01-11*
*상태: 설계 완료, 구현 대기*
