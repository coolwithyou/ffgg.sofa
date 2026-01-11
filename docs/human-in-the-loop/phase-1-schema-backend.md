# Phase 1: 스키마 + 백엔드 파이프라인

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | 검증 시스템의 데이터 기반 구축 |
| **산출물** | 3개 테이블 + Inngest 이벤트 + 수정된 변환 로직 |
| **의존성** | 기존 Knowledge Pages 스키마 |
| **예상 기간** | 3일 |

---

## 수정 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `drizzle/schema.ts` | 수정 | 3개 테이블 추가 |
| `lib/db/index.ts` | 수정 | 새 테이블 export |
| `lib/knowledge-pages/types.ts` | 수정 | 검증 관련 타입 추가 |
| `lib/knowledge-pages/document-to-pages.ts` | 수정 | 검증 세션 생성으로 변경 |
| `inngest/functions/process-document.ts` | 수정 | 검증 이벤트 발행 |
| `inngest/functions/validate-claims.ts` | 신규 | 검증 파이프라인 오케스트레이션 |

---

## 스키마 상세

### 1. validation_sessions 테이블

검증 세션: 문서 변환 후 검증 대기 상태를 관리합니다.

```typescript
// drizzle/schema.ts에 추가

/**
 * 검증 세션 테이블
 *
 * 문서 → Knowledge Pages 변환 과정에서 생성되는 검증 단위입니다.
 * 하나의 문서 업로드당 하나의 세션이 생성됩니다.
 */
export const validationSessions = pgTable(
  'validation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),

    // 원본 및 재구성 데이터
    originalText: text('original_text').notNull(),
    originalPdfUrl: text('original_pdf_url'),              // S3 URL (PDF인 경우)
    reconstructedMarkdown: text('reconstructed_markdown'), // LLM 재구성 결과
    structureJson: jsonb('structure_json'),                // 구조 분석 JSON

    // 페이지 매핑 (PDF → 텍스트 위치)
    pageMapping: jsonb('page_mapping').$type<{
      pageNumber: number;
      startChar: number;
      endChar: number;
    }[]>(),

    // 상태 머신
    status: text('status', {
      enum: [
        'pending',           // 생성됨, 분석 대기
        'analyzing',         // 구조 분석 중
        'extracting_claims', // Claim 추출 중
        'verifying',         // 검증 중
        'ready_for_review',  // 검토 준비 완료
        'reviewing',         // 사용자 검토 중
        'approved',          // 승인 완료
        'rejected',          // 거부됨
        'expired',           // 만료됨
      ],
    })
      .notNull()
      .default('pending'),

    // 검증 결과 요약 (UI 표시용)
    totalClaims: integer('total_claims').default(0),
    supportedCount: integer('supported_count').default(0),
    contradictedCount: integer('contradicted_count').default(0),
    notFoundCount: integer('not_found_count').default(0),
    highRiskCount: integer('high_risk_count').default(0),
    riskScore: real('risk_score'),                         // 0.0 ~ 1.0

    // 사용자 검토 메타데이터
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),

    // 생성된 페이지 (승인 후)
    generatedPagesCount: integer('generated_pages_count').default(0),

    // 타임스탬프
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // 7일 후
  },
  (table) => [
    index('idx_validation_sessions_chatbot').on(table.chatbotId),
    index('idx_validation_sessions_status').on(table.status),
    index('idx_validation_sessions_document').on(table.documentId),
    index('idx_validation_sessions_expires').on(table.expiresAt),
  ]
);
```

### 2. claims 테이블

검증 가능한 주장(Claim) 단위입니다.

```typescript
/**
 * Claim 테이블
 *
 * 재구성된 문서에서 추출된 검증 가능한 주장입니다.
 * 각 Claim은 원문의 근거(SourceSpan)와 매핑됩니다.
 */
export const claims = pgTable(
  'claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => validationSessions.id, { onDelete: 'cascade' }),

    // Claim 내용
    claimText: text('claim_text').notNull(),               // "연락처 수는 30개입니다"
    claimType: text('claim_type', {
      enum: ['numeric', 'contact', 'date', 'text', 'list', 'table'],
    }).notNull(),

    // 재구성본에서의 위치
    reconstructedLocation: jsonb('reconstructed_location').$type<{
      startLine: number;
      endLine: number;
      startChar: number;
      endChar: number;
    }>(),

    // AI 자동 검증 결과
    verdict: text('verdict', {
      enum: ['supported', 'contradicted', 'not_found', 'pending'],
    })
      .notNull()
      .default('pending'),
    confidence: real('confidence'),                        // 0.0 ~ 1.0
    verificationLevel: text('verification_level', {
      enum: ['regex', 'llm', 'human'],
    }),
    verificationDetail: text('verification_detail'),       // 검증 상세 설명

    // 위험도 분류
    riskLevel: text('risk_level', {
      enum: ['high', 'medium', 'low'],
    })
      .notNull()
      .default('low'),

    // 의심 유형 (AI가 발견한 문제)
    suspicionType: text('suspicion_type', {
      enum: ['added', 'missing', 'moved', 'contradicted', 'none'],
    }),
    suspicionDetail: text('suspicion_detail'),

    // 사용자 검토 결과
    humanVerdict: text('human_verdict', {
      enum: ['approved', 'rejected', 'modified', 'skipped'],
    }),
    humanNote: text('human_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    // 정렬용
    sortOrder: integer('sort_order').notNull().default(0),

    // 타임스탬프
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_claims_session').on(table.sessionId),
    index('idx_claims_verdict').on(table.verdict),
    index('idx_claims_risk').on(table.riskLevel),
    index('idx_claims_human_verdict').on(table.humanVerdict),
  ]
);
```

### 3. source_spans 테이블

원문 근거 영역 매핑입니다.

```typescript
/**
 * SourceSpan 테이블
 *
 * Claim의 원문 근거 영역입니다.
 * 하나의 Claim은 0~N개의 SourceSpan을 가질 수 있습니다.
 */
export const sourceSpans = pgTable(
  'source_spans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),

    // 원문 위치
    sourceText: text('source_text').notNull(),             // 매칭된 원문 스니펫
    startChar: integer('start_char').notNull(),
    endChar: integer('end_char').notNull(),
    pageNumber: integer('page_number'),                    // PDF 페이지 (1-indexed)

    // 매칭 품질
    matchScore: real('match_score'),                       // 0.0 ~ 1.0
    matchMethod: text('match_method', {
      enum: ['exact', 'fuzzy', 'semantic'],
    }).notNull(),

    // 타임스탬프
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_source_spans_claim').on(table.claimId),
  ]
);

// 타입 추출
export type ValidationSession = typeof validationSessions.$inferSelect;
export type NewValidationSession = typeof validationSessions.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type SourceSpan = typeof sourceSpans.$inferSelect;
export type NewSourceSpan = typeof sourceSpans.$inferInsert;
```

---

## 수정된 변환 로직

### document-to-pages.ts

기존 로직을 검증 세션 생성으로 변경합니다.

```typescript
// lib/knowledge-pages/document-to-pages.ts

import { db } from '@/lib/db';
import { validationSessions } from '@/drizzle/schema';
import { inngest } from '@/inngest/client';

/**
 * 문서 → Knowledge Pages 변환 (검증 버전)
 *
 * 기존: 바로 페이지 생성
 * 변경: 검증 세션 생성 → 사용자 승인 후 페이지 생성
 */
export async function convertDocumentToPages(
  documentText: string,
  options: ConversionOptions,
  onProgress?: (progress: ConversionProgress) => void
): Promise<ConversionResult> {
  const { chatbotId, documentId, tenantId, parentPageId, pdfUrl } = options;

  try {
    // Step 1: 검증 세션 생성
    onProgress?.({
      status: 'creating_session',
      currentStep: '검증 세션 생성 중...',
      totalPages: 0,
      completedPages: 0,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

    const [session] = await db
      .insert(validationSessions)
      .values({
        tenantId,
        chatbotId,
        documentId,
        originalText: documentText,
        originalPdfUrl: pdfUrl,
        status: 'pending',
        expiresAt,
      })
      .returning();

    logger.info('[DocumentToPages] Validation session created', {
      sessionId: session.id,
      chatbotId,
      documentId,
    });

    // Step 2: 비동기 검증 파이프라인 시작
    await inngest.send({
      name: 'knowledge-pages/validate-document',
      data: {
        sessionId: session.id,
        chatbotId,
        tenantId,
        parentPageId,
      },
    });

    onProgress?.({
      status: 'pending_validation',
      currentStep: '검증 대기 중...',
      totalPages: 0,
      completedPages: 0,
      sessionId: session.id,
    });

    return {
      success: true,
      sessionId: session.id,
      status: 'pending_validation',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    logger.error('[DocumentToPages] Failed to create validation session', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
```

---

## Inngest 검증 파이프라인

### validate-claims.ts (신규)

```typescript
// inngest/functions/validate-claims.ts

import { inngest } from '../client';
import { db } from '@/lib/db';
import { validationSessions, claims } from '@/drizzle/schema';
import { eq, and, count } from 'drizzle-orm';
import { analyzeDocumentStructure } from '@/lib/knowledge-pages/document-to-pages';
import { extractClaims } from '@/lib/knowledge-pages/verification/claim-extractor';
import { verifyWithRegex } from '@/lib/knowledge-pages/verification/regex-verifier';
import { verifyWithLLM } from '@/lib/knowledge-pages/verification/llm-verifier';
import { calculateRiskScore } from '@/lib/knowledge-pages/verification/risk-calculator';

export const validateDocument = inngest.createFunction(
  {
    id: 'validate-document',
    concurrency: { limit: 5 },
    retries: 2,
  },
  { event: 'knowledge-pages/validate-document' },
  async ({ event, step }) => {
    const { sessionId, chatbotId, tenantId, parentPageId } = event.data;

    // Step 1: 상태 업데이트 → analyzing
    await step.run('update-status-analyzing', async () => {
      await db
        .update(validationSessions)
        .set({ status: 'analyzing', updatedAt: new Date() })
        .where(eq(validationSessions.id, sessionId));
    });

    // Step 2: 구조 분석 + 마크다운 재구성
    const structure = await step.run('analyze-structure', async () => {
      const session = await db.query.validationSessions.findFirst({
        where: eq(validationSessions.id, sessionId),
      });
      if (!session) throw new Error('Session not found');

      const result = await analyzeDocumentStructure(session.originalText);

      // 재구성 마크다운 생성
      const markdown = await generateReconstructedMarkdown(result, session.originalText);

      await db
        .update(validationSessions)
        .set({
          structureJson: result,
          reconstructedMarkdown: markdown,
          status: 'extracting_claims',
          updatedAt: new Date(),
        })
        .where(eq(validationSessions.id, sessionId));

      return { structure: result, markdown };
    });

    // Step 3: Claim 추출
    const extractedClaims = await step.run('extract-claims', async () => {
      const result = await extractClaims(sessionId, structure.markdown);

      await db
        .update(validationSessions)
        .set({
          totalClaims: result.length,
          status: 'verifying',
          updatedAt: new Date(),
        })
        .where(eq(validationSessions.id, sessionId));

      return result;
    });

    // Step 4: Regex 검증 (Level 1)
    await step.run('verify-regex', async () => {
      const regexTargets = extractedClaims.filter(
        (c) => ['numeric', 'contact', 'date'].includes(c.claimType)
      );
      await verifyWithRegex(sessionId, regexTargets);
    });

    // Step 5: LLM 검증 (Level 2) - 배치 처리
    const pendingClaims = await step.run('get-pending-claims', async () => {
      return await db.query.claims.findMany({
        where: and(
          eq(claims.sessionId, sessionId),
          eq(claims.verdict, 'pending')
        ),
      });
    });

    // 5개씩 배치 처리
    const batchSize = 5;
    for (let i = 0; i < pendingClaims.length; i += batchSize) {
      const batch = pendingClaims.slice(i, i + batchSize);
      await step.run(`verify-llm-batch-${i}`, async () => {
        await verifyWithLLM(sessionId, batch);
      });
    }

    // Step 6: 위험도 점수 계산
    await step.run('calculate-risk', async () => {
      await calculateRiskScore(sessionId);
    });

    // Step 7: 상태 업데이트 → ready_for_review
    await step.run('finalize', async () => {
      const counts = await db
        .select({
          supported: count(and(eq(claims.verdict, 'supported'))),
          contradicted: count(and(eq(claims.verdict, 'contradicted'))),
          notFound: count(and(eq(claims.verdict, 'not_found'))),
          highRisk: count(and(eq(claims.riskLevel, 'high'))),
        })
        .from(claims)
        .where(eq(claims.sessionId, sessionId));

      await db
        .update(validationSessions)
        .set({
          supportedCount: counts[0].supported,
          contradictedCount: counts[0].contradicted,
          notFoundCount: counts[0].notFound,
          highRiskCount: counts[0].highRisk,
          status: 'ready_for_review',
          updatedAt: new Date(),
        })
        .where(eq(validationSessions.id, sessionId));
    });

    return { sessionId, status: 'ready_for_review' };
  }
);
```

---

## 타입 정의 추가

### types.ts 확장

```typescript
// lib/knowledge-pages/types.ts에 추가

/**
 * 검증 세션 상태
 */
export type ValidationStatus =
  | 'pending'
  | 'analyzing'
  | 'extracting_claims'
  | 'verifying'
  | 'ready_for_review'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'expired';

/**
 * Claim 타입
 */
export type ClaimType = 'numeric' | 'contact' | 'date' | 'text' | 'list' | 'table';

/**
 * AI 판정 결과
 */
export type Verdict = 'supported' | 'contradicted' | 'not_found' | 'pending';

/**
 * 위험도 레벨
 */
export type RiskLevel = 'high' | 'medium' | 'low';

/**
 * 의심 유형
 */
export type SuspicionType = 'added' | 'missing' | 'moved' | 'contradicted' | 'none';

/**
 * 사용자 판정 결과
 */
export type HumanVerdict = 'approved' | 'rejected' | 'modified' | 'skipped';

/**
 * 검증 이벤트 데이터
 */
export interface ValidateDocumentEventData {
  sessionId: string;
  chatbotId: string;
  tenantId: string;
  parentPageId?: string;
}

/**
 * 변환 결과 (검증 버전)
 */
export interface ConversionResult {
  success: boolean;
  sessionId?: string;
  status?: 'pending_validation';
  pages?: GeneratedPage[];
  error?: string;
  totalPageCount?: number;
}
```

---

## Inngest 이벤트 등록

### inngest/client.ts 수정

```typescript
// inngest/client.ts

import { Inngest } from 'inngest';

// 이벤트 타입 정의
type Events = {
  'document/process': {
    data: {
      documentId: string;
      chatbotId: string;
      tenantId: string;
    };
  };
  // 신규: 검증 이벤트
  'knowledge-pages/validate-document': {
    data: {
      sessionId: string;
      chatbotId: string;
      tenantId: string;
      parentPageId?: string;
    };
  };
};

export const inngest = new Inngest({
  id: 'sofa',
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

---

## 마이그레이션 절차

```bash
# 1. 마이그레이션 파일 생성
pnpm db:generate

# 2. 마이그레이션 실행
pnpm db:migrate

# 3. 타입 확인
pnpm typecheck
```

---

## 체크리스트

- [ ] `drizzle/schema.ts`에 3개 테이블 추가
  - [ ] `validationSessions` 테이블
  - [ ] `claims` 테이블
  - [ ] `sourceSpans` 테이블
- [ ] `pnpm db:generate && pnpm db:migrate` 실행
- [ ] `lib/db/index.ts`에 새 테이블 export 추가
- [ ] `lib/knowledge-pages/types.ts`에 검증 타입 추가
- [ ] `lib/knowledge-pages/document-to-pages.ts` 검증 세션 생성 로직으로 수정
- [ ] `inngest/functions/validate-claims.ts` 생성
- [ ] `inngest/client.ts`에 이벤트 등록
- [ ] Inngest Dev Server에서 이벤트 흐름 확인

---

## 테스트 방법

### 1. 로컬 개발 환경 설정

```bash
# Inngest Dev Server 실행
npx inngest-cli dev

# Next.js 개발 서버 실행
pnpm dev
```

### 2. 이벤트 흐름 확인

Inngest Dev Dashboard (`http://localhost:8288`)에서:

1. 문서 업로드 시 `knowledge-pages/validate-document` 이벤트 발행 확인
2. 각 step 실행 순서 확인
3. 최종 상태 `ready_for_review` 확인

### 3. DB 상태 확인

```sql
-- 검증 세션 확인
SELECT id, status, total_claims, risk_score
FROM validation_sessions
WHERE chatbot_id = 'xxx'
ORDER BY created_at DESC;

-- Claim 확인
SELECT claim_text, claim_type, verdict, risk_level
FROM claims
WHERE session_id = 'xxx';
```

---

## 다음 단계

[Phase 2: Claim 추출 및 검증 엔진](./phase-2-verification-engine.md)에서 실제 Claim 추출 및 검증 로직을 구현합니다.

---

*작성일: 2026-01-11*
