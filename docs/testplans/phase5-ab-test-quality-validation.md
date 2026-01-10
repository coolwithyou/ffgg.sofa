# Phase 5: A/B 테스트 및 품질 검증 구현 계획

> **작성일**: 2026-01-10
> **예상 기간**: 3일
> **담당**: AI Development Team
> **상태**: 🔵 계획 완료, 구현 대기

---

## 목차

1. [프로젝트 배경](#프로젝트-배경)
2. [이전 Phase 요약](#이전-phase-요약)
3. [Phase 5 개요](#phase-5-개요)
4. [현재 상태 분석](#현재-상태-분석)
5. [구현 태스크](#구현-태스크)
6. [Day 1: 코어 로직](#day-1-코어-로직)
7. [Day 2: 스키마 + API + 파이프라인](#day-2-스키마--api--파이프라인)
8. [Day 3: 어드민 콘솔 UI](#day-3-어드민-콘솔-ui)
9. [파일 구조](#파일-구조)
10. [검증 계획](#검증-계획)
11. [리스크 및 대응](#리스크-및-대응)
12. [참고 자료](#참고-자료)

---

## 프로젝트 배경

### SOFA RAG 파이프라인 개선 로드맵

SOFA(Smart Operator's FAQ Assistant)는 RAG 기반 챗봇 플랫폼입니다. 2026년 1월부터 RAG 파이프라인의 품질과 비용 효율성을 개선하기 위한 5단계 로드맵을 진행 중입니다.

```
Phase 1: AI Semantic Chunking     [완료] adf67a3
Phase 2: Late Chunking 통합       [완료]
Phase 3: 형태소 분석기 + Reranking [완료]
Phase 4: Prompt Caching 비용 최적화 [완료] f225ce4
Phase 5: A/B 테스트 및 품질 검증   [현재] ← 이 문서
```

### 목표

1. **청킹 전략 효과 검증**: Semantic Chunking vs 규칙 기반 청킹의 실제 품질 차이 측정
2. **데이터 기반 의사결정**: 챗봇별 최적 전략 선택을 위한 A/B 테스트 인프라
3. **운영 가시성 확보**: 어드민 콘솔에서 품질 메트릭 실시간 모니터링

---

## 이전 Phase 요약

### Phase 1: AI Semantic Chunking (완료)

**커밋**: `adf67a3`

LLM(Claude Haiku)을 활용한 의미 기반 청킹 도입.

| 항목 | 내용 |
|------|------|
| 핵심 파일 | `lib/rag/semantic-chunking.ts` |
| 주요 함수 | `semanticChunk()`, `isSemanticChunkingEnabled()` |
| 활성화 조건 | `ANTHROPIC_API_KEY` 환경변수 설정 |

```typescript
// 현재 글로벌 ON/OFF 로직
export function isSemanticChunkingEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY &&
         process.env.DISABLE_SEMANTIC_CHUNKING !== 'true';
}
```

**문제점**: 글로벌 설정만 가능, 챗봇별 A/B 테스트 불가

### Phase 2: Late Chunking 통합 (완료)

문서 전체 임베딩 후 청크별 풀링으로 문맥 보존 향상.

| 항목 | 내용 |
|------|------|
| 핵심 파일 | `lib/rag/late-chunking.ts` |
| 주요 함수 | `lateChunk()`, `addLateChunkingEmbeddings()` |

### Phase 3: 형태소 분석기 + Reranking (완료)

한국어 문장 경계 감지 및 검색 결과 재정렬 도입.

| 항목 | 내용 |
|------|------|
| 핵심 파일 | `lib/nlp/morphological-analyzer.ts` |
| 주요 함수 | `analyzeSentenceBoundaries()` |

### Phase 4: Prompt Caching 비용 최적화 (완료)

**커밋**: `f225ce4`

Anthropic Prompt Caching을 적용하여 반복 호출 비용 90% 절감.

| 항목 | 내용 |
|------|------|
| 핵심 파일 | `lib/rag/anthropic-cache.ts` |
| 주요 함수 | `generateWithCache()`, `isCacheEffective()`, `calculateCostSavings()` |
| 적용 대상 | `semantic-chunking.ts`, `morphological-analyzer.ts` |

```typescript
// lib/rag/anthropic-cache.ts
export async function generateWithCache(
  options: CachedAnthropicOptions
): Promise<CachedAnthropicResult>

export function isCacheEffective(systemPrompt: string): boolean

export function calculateCostSavings(
  cacheReadTokens: number,
  totalInputTokens: number
): number
```

---

## Phase 5 개요

### 사용자 요청

> "phase 5도 진행하자, a/b테스트 품질 검증은 필수 로직 생성 후, 어드민 콘솔에 관련 ui를 만들면 어떨까?"

### 접근 방식

```
코어 로직 (Day 1) → 스키마/API/파이프라인 (Day 2) → 어드민 콘솔 UI (Day 3)
```

### 핵심 기능

1. **챗봇별 청킹 전략 설정**: 글로벌이 아닌 개별 챗봇 단위로 전략 선택
2. **A/B 테스트 트래픽 분배**: 지정된 비율로 control/treatment 그룹 분배
3. **품질 메트릭 집계**: 전략별 품질 점수 통계 및 비교
4. **어드민 대시보드**: 실험 설정 UI + 결과 시각화

---

## 현재 상태 분석

### 청킹 전략 전환 로직 (현재)

**파일**: `lib/rag/semantic-chunking.ts` (Line 289-291)

```typescript
export function isSemanticChunkingEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY &&
         process.env.DISABLE_SEMANTIC_CHUNKING !== 'true';
}
```

**문제점**:
- 환경변수 기반 글로벌 ON/OFF만 가능
- 챗봇별 A/B 테스트 불가
- 전략 효과 비교 데이터 수집 불가

### 품질 점수 시스템 (현재)

| 위치 | 함수 | 설명 |
|------|------|------|
| `lib/rag/chunking.ts:712-819` | `calculateQualityScore()` | 8개 평가 기준 (규칙 기반 청킹용) |
| `lib/rag/semantic-chunking.ts:341-366` | `calculateSemanticQualityScore()` | 의미적 품질 평가 (AI 청킹용) |

**현재 데이터**: `chunks` 테이블에 `qualityScore`, `autoApproved`, `metadata` 저장됨

### 기존 DB 스키마 패턴

`chatbots` 테이블은 JSONB 필드로 유연한 설정 저장:

```typescript
// drizzle/schema.ts - chatbots 테이블
llmConfig: jsonb('llm_config'),
searchConfig: jsonb('search_config'),
behaviorConfig: jsonb('behavior_config'),
styleConfig: jsonb('style_config'),
```

→ `experimentConfig` 필드를 동일한 패턴으로 추가

### 기존 UI 컴포넌트 (재사용 가능)

| 컴포넌트 | 위치 | 용도 |
|----------|------|------|
| `QualityIndicator` | `app/(console)/console/chatbot/_components/quality-indicator.tsx` | 프로그레스 바 품질 표시 |
| `QualityBadge` | 동일 | 컴팩트 배지 |
| `QualitySummary` | 동일 | 4-카드 요약 |

---

## 구현 태스크

| 태스크 | 난이도 | 우선순위 | Day | 설명 |
|--------|--------|----------|-----|------|
| 1. 타입 정의 | ★☆☆ | 높음 | 1 | ExperimentConfig, QualityMetrics 타입 |
| 2. 전략 결정 함수 | ★★☆ | 높음 | 1 | 챗봇별 A/B 분기 로직 |
| 3. 품질 집계 함수 | ★★☆ | 높음 | 1 | 전략별 통계 쿼리 |
| 4. 스키마 확장 | ★☆☆ | 높음 | 2 | experimentConfig 필드 추가 |
| 5. API 엔드포인트 | ★★☆ | 중간 | 2 | 설정 저장 + 통계 조회 |
| 6. 청킹 파이프라인 수정 | ★★☆ | 높음 | 2 | process-document.ts 분기 |
| 7. 실험 설정 UI | ★★☆ | 중간 | 3 | AI 설정 페이지 섹션 |
| 8. 품질 대시보드 | ★★★ | 중간 | 3 | 대시보드 카드/차트 |

---

## Day 1: 코어 로직

### 1.1 타입 정의

**파일**: `types/experiment.ts` (신규)

```typescript
/**
 * 청킹 실험 설정
 *
 * chatbots.experimentConfig JSONB 필드에 저장됨
 */
export interface ExperimentConfig {
  /** 청킹 전략 */
  chunkingStrategy: 'smart' | 'semantic' | 'late' | 'auto';

  /** A/B 테스트 활성화 */
  abTestEnabled: boolean;

  /** semantic 트래픽 비율 (0-100) */
  semanticTrafficPercent?: number;

  /** 실험 시작일 */
  experimentStartedAt?: string;
}

/**
 * 전략별 품질 메트릭
 */
export interface QualityMetrics {
  /** 청킹 전략 */
  strategy: string;

  /** A/B 테스트 변형 (control: 기존, treatment: 신규) */
  variant: 'control' | 'treatment' | null;

  /** 총 청크 수 */
  totalChunks: number;

  /** 평균 품질 점수 (0-100) */
  avgQualityScore: number;

  /** 자동 승인율 (0-1) */
  autoApprovedRate: number;

  /** 점수 분포 */
  scoreDistribution: {
    excellent: number;  // 85+
    good: number;       // 70-84
    fair: number;       // 50-69
    poor: number;       // <50
  };
}

/**
 * A/B 테스트 분석 결과
 */
export interface ABTestResult {
  /** 대조군(기존 전략) 메트릭 */
  controlMetrics: QualityMetrics;

  /** 처리군(신규 전략) 메트릭 */
  treatmentMetrics: QualityMetrics;

  /** 품질 점수 차이 (treatment - control) */
  qualityDelta: number;

  /** 품질 점수 차이 백분율 */
  qualityDeltaPercent: number;

  /** 통계적 유의성 여부 */
  isSignificant: boolean;

  /** 권장 조치 */
  recommendation: 'adopt_treatment' | 'keep_control' | 'need_more_data';
}
```

### 1.2 전략 결정 함수

**파일**: `lib/rag/experiment.ts` (신규)

```typescript
import { isSemanticChunkingEnabled } from './semantic-chunking';
import type { ExperimentConfig } from '@/types/experiment';

/**
 * 청킹 전략 결정 결과
 */
export interface ChunkingStrategyResult {
  /** 선택된 전략 */
  strategy: 'smart' | 'semantic' | 'late';

  /** A/B 테스트 변형 (null = A/B 테스트 아님) */
  variant: 'control' | 'treatment' | null;

  /** 결정 사유 */
  reason: 'global_setting' | 'ab_test' | 'fixed_strategy';
}

/**
 * 챗봇별 청킹 전략 결정
 *
 * 우선순위:
 * 1. experimentConfig가 있으면 해당 설정 사용
 * 2. A/B 테스트 활성화 시 트래픽 비율에 따라 분배
 * 3. 없으면 글로벌 환경변수 설정 사용
 *
 * @param chatbotId - 챗봇 ID
 * @param experimentConfig - 챗봇별 실험 설정 (null이면 글로벌 설정)
 * @returns 청킹 전략 결정 결과
 *
 * @example
 * ```typescript
 * const result = determineChunkingStrategy('chatbot-123', {
 *   chunkingStrategy: 'auto',
 *   abTestEnabled: true,
 *   semanticTrafficPercent: 50,
 * });
 * // result.strategy = 'semantic' or 'smart'
 * // result.variant = 'treatment' or 'control'
 * ```
 */
export function determineChunkingStrategy(
  chatbotId: string,
  experimentConfig: ExperimentConfig | null
): ChunkingStrategyResult {
  // 1. experimentConfig 없으면 글로벌 설정 사용
  if (!experimentConfig) {
    return {
      strategy: isSemanticChunkingEnabled() ? 'semantic' : 'smart',
      variant: null,
      reason: 'global_setting',
    };
  }

  // 2. A/B 테스트 활성화 시 트래픽 분배
  if (experimentConfig.abTestEnabled) {
    // 일관된 분배를 위해 chatbotId 해시 사용 가능 (추후 개선)
    const random = Math.random() * 100;
    const isSemanticVariant = random < (experimentConfig.semanticTrafficPercent ?? 50);

    return {
      strategy: isSemanticVariant ? 'semantic' : 'smart',
      variant: isSemanticVariant ? 'treatment' : 'control',
      reason: 'ab_test',
    };
  }

  // 3. 고정 전략
  const strategy = experimentConfig.chunkingStrategy === 'auto'
    ? (isSemanticChunkingEnabled() ? 'semantic' : 'smart')
    : experimentConfig.chunkingStrategy;

  return {
    strategy: strategy as 'smart' | 'semantic' | 'late',
    variant: null,
    reason: 'fixed_strategy',
  };
}

/**
 * 문서 ID 기반 일관된 A/B 분배 (선택적 개선)
 *
 * 동일 문서가 항상 같은 그룹에 배정되도록 해시 기반 분배
 */
export function getConsistentVariant(
  documentId: string,
  semanticTrafficPercent: number
): 'control' | 'treatment' {
  // 간단한 해시: 문자 코드 합계 mod 100
  const hash = documentId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100;

  return hash < semanticTrafficPercent ? 'treatment' : 'control';
}
```

### 1.3 품질 집계 함수

**파일**: `lib/rag/quality-metrics.ts` (신규)

```typescript
import { db } from '@/drizzle';
import { chunks } from '@/drizzle/schema';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
import type { QualityMetrics, ABTestResult } from '@/types/experiment';

/**
 * 전략별 품질 메트릭 조회
 *
 * @param chatbotId - 챗봇 ID
 * @param dateRange - 조회 기간 (선택)
 * @returns 전략별 품질 메트릭 배열
 */
export async function getQualityMetricsByStrategy(
  chatbotId: string,
  dateRange?: { from: Date; to: Date }
): Promise<QualityMetrics[]> {
  // 날짜 조건 구성
  const dateConditions = dateRange
    ? and(
        gte(chunks.createdAt, dateRange.from),
        lte(chunks.createdAt, dateRange.to)
      )
    : undefined;

  const whereConditions = dateConditions
    ? and(eq(chunks.chatbotId, chatbotId), dateConditions)
    : eq(chunks.chatbotId, chatbotId);

  // Raw SQL로 전략별 집계
  const result = await db.execute(sql`
    SELECT
      COALESCE(metadata->>'chunkingStrategy', 'unknown') as strategy,
      metadata->>'experimentVariant' as variant,
      COUNT(*)::int as total_chunks,
      COALESCE(AVG(quality_score), 0)::float as avg_quality,
      COALESCE(
        SUM(CASE WHEN auto_approved THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(*), 0),
        0
      ) as auto_approved_rate,
      COALESCE(SUM(CASE WHEN quality_score >= 85 THEN 1 ELSE 0 END), 0)::int as excellent,
      COALESCE(SUM(CASE WHEN quality_score >= 70 AND quality_score < 85 THEN 1 ELSE 0 END), 0)::int as good,
      COALESCE(SUM(CASE WHEN quality_score >= 50 AND quality_score < 70 THEN 1 ELSE 0 END), 0)::int as fair,
      COALESCE(SUM(CASE WHEN quality_score < 50 THEN 1 ELSE 0 END), 0)::int as poor
    FROM chunks
    WHERE chatbot_id = ${chatbotId}
      ${dateRange ? sql`AND created_at >= ${dateRange.from} AND created_at <= ${dateRange.to}` : sql``}
    GROUP BY strategy, variant
    ORDER BY strategy, variant
  `);

  return transformResults(result.rows as RawMetricRow[]);
}

interface RawMetricRow {
  strategy: string;
  variant: string | null;
  total_chunks: number;
  avg_quality: number;
  auto_approved_rate: number;
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

function transformResults(rows: RawMetricRow[]): QualityMetrics[] {
  return rows.map((row) => ({
    strategy: row.strategy,
    variant: row.variant as 'control' | 'treatment' | null,
    totalChunks: row.total_chunks,
    avgQualityScore: Math.round(row.avg_quality * 100) / 100,
    autoApprovedRate: Math.round(row.auto_approved_rate * 1000) / 1000,
    scoreDistribution: {
      excellent: row.excellent,
      good: row.good,
      fair: row.fair,
      poor: row.poor,
    },
  }));
}

/**
 * A/B 테스트 결과 분석
 *
 * @param control - 대조군 메트릭
 * @param treatment - 처리군 메트릭
 * @returns A/B 테스트 분석 결과
 */
export function analyzeABTest(
  control: QualityMetrics,
  treatment: QualityMetrics
): ABTestResult {
  const qualityDelta = treatment.avgQualityScore - control.avgQualityScore;
  const qualityDeltaPercent = control.avgQualityScore > 0
    ? (qualityDelta / control.avgQualityScore) * 100
    : 0;

  // 최소 샘플 크기 체크 (각 그룹 100개 이상)
  const minSampleSize = 100;
  const hasEnoughData =
    control.totalChunks >= minSampleSize &&
    treatment.totalChunks >= minSampleSize;

  // 유의성 판단 (간단한 휴리스틱: 2점 이상 차이)
  const isSignificant = hasEnoughData && Math.abs(qualityDelta) > 2;

  // 권장 조치 결정
  let recommendation: ABTestResult['recommendation'];
  if (!hasEnoughData) {
    recommendation = 'need_more_data';
  } else if (qualityDelta > 2) {
    recommendation = 'adopt_treatment';
  } else {
    recommendation = 'keep_control';
  }

  return {
    controlMetrics: control,
    treatmentMetrics: treatment,
    qualityDelta: Math.round(qualityDelta * 100) / 100,
    qualityDeltaPercent: Math.round(qualityDeltaPercent * 100) / 100,
    isSignificant,
    recommendation,
  };
}

/**
 * 전체 챗봇 품질 요약 조회
 *
 * 대시보드용 전체 통계
 */
export async function getOverallQualityStats(chatbotId: string): Promise<{
  totalChunks: number;
  avgQualityScore: number;
  autoApprovedRate: number;
  hasExperiment: boolean;
}> {
  const metrics = await getQualityMetricsByStrategy(chatbotId);

  const totalChunks = metrics.reduce((sum, m) => sum + m.totalChunks, 0);
  const weightedSum = metrics.reduce(
    (sum, m) => sum + m.avgQualityScore * m.totalChunks,
    0
  );
  const avgQualityScore = totalChunks > 0 ? weightedSum / totalChunks : 0;

  const approvedSum = metrics.reduce(
    (sum, m) => sum + m.autoApprovedRate * m.totalChunks,
    0
  );
  const autoApprovedRate = totalChunks > 0 ? approvedSum / totalChunks : 0;

  const hasExperiment = metrics.some((m) => m.variant !== null);

  return {
    totalChunks,
    avgQualityScore: Math.round(avgQualityScore * 100) / 100,
    autoApprovedRate: Math.round(autoApprovedRate * 1000) / 1000,
    hasExperiment,
  };
}
```

---

## Day 2: 스키마 + API + 파이프라인

### 2.1 스키마 확장

**파일**: `drizzle/schema.ts`

```typescript
// chatbots 테이블에 experimentConfig 필드 추가
export const chatbots = pgTable('chatbots', {
  // ... 기존 필드들 ...

  // 신규 추가
  experimentConfig: jsonb('experiment_config').$type<ExperimentConfig>(),
});
```

**마이그레이션 명령**:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 2.2 API 엔드포인트

#### 기존 PATCH 확장

**파일**: `app/api/chatbots/[id]/route.ts`

```typescript
import { z } from 'zod';

// Zod 스키마 확장
const experimentConfigSchema = z.object({
  chunkingStrategy: z.enum(['smart', 'semantic', 'late', 'auto']).optional(),
  abTestEnabled: z.boolean().optional(),
  semanticTrafficPercent: z.number().min(0).max(100).optional(),
  experimentStartedAt: z.string().optional(),
}).optional();

const updateChatbotSchema = z.object({
  // ... 기존 스키마 ...
  experimentConfig: experimentConfigSchema,
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 기존 로직에 experimentConfig 업데이트 추가
  const body = await request.json();
  const validated = updateChatbotSchema.parse(body);

  // ... 업데이트 로직 ...
}
```

#### 품질 통계 API (신규)

**파일**: `app/api/chatbots/[id]/quality-metrics/route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getQualityMetricsByStrategy, analyzeABTest } from '@/lib/rag/quality-metrics';
import { requireAuth } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const chatbotId = params.id;

  // 날짜 범위 파싱 (선택)
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const dateRange = from && to
    ? { from: new Date(from), to: new Date(to) }
    : undefined;

  // 전략별 메트릭 조회
  const metrics = await getQualityMetricsByStrategy(chatbotId, dateRange);

  // A/B 테스트 분석 (control/treatment 둘 다 있는 경우)
  const control = metrics.find((m) => m.variant === 'control');
  const treatment = metrics.find((m) => m.variant === 'treatment');
  const abTestResult = control && treatment
    ? analyzeABTest(control, treatment)
    : null;

  return NextResponse.json({
    metrics,
    abTestResult,
    dateRange: dateRange ?? null,
  });
}
```

### 2.3 청킹 파이프라인 수정

**파일**: `inngest/functions/process-document.ts`

```typescript
import { determineChunkingStrategy } from '@/lib/rag/experiment';
import { semanticChunk } from '@/lib/rag/semantic-chunking';
import { lateChunk } from '@/lib/rag/late-chunking';
import { smartChunk } from '@/lib/rag/chunking';

// Step 3: 청킹 로직 수정
const chatbot = await getChatbot(chatbotId);
const strategyResult = determineChunkingStrategy(
  chatbotId,
  chatbot.experimentConfig
);

logger.info('[ProcessDocument] Chunking strategy determined', {
  documentId,
  strategy: strategyResult.strategy,
  variant: strategyResult.variant,
  reason: strategyResult.reason,
});

// 전략에 따른 청킹 실행
let chunks: ChunkData[];

switch (strategyResult.strategy) {
  case 'semantic':
    chunks = await semanticChunk(content, {
      minChunkSize: 100,
      maxChunkSize: 600,
      preChunkSize: 2000,
    });
    break;

  case 'late':
    chunks = await lateChunk(content, {
      chunkSize: 500,
      overlap: 50,
    });
    break;

  case 'smart':
  default:
    chunks = smartChunk(content, {
      chunkSize: 500,
      overlap: 50,
    });
    break;
}

// 메타데이터에 전략 정보 추가 (A/B 분석용)
chunks = chunks.map((chunk) => ({
  ...chunk,
  metadata: {
    ...chunk.metadata,
    chunkingStrategy: strategyResult.strategy,
    experimentVariant: strategyResult.variant,
    strategyReason: strategyResult.reason,
  },
}));
```

---

## Day 3: 어드민 콘솔 UI

### 3.1 실험 설정 섹션

**파일**: `app/(console)/console/chatbot/ai/page.tsx`

기존 AI 설정 페이지에 실험 설정 카드 추가:

```tsx
import { FlaskConical, Beaker } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

// 실험 설정 카드 컴포넌트
function ExperimentSettingsCard({
  experimentConfig,
  onUpdate,
}: {
  experimentConfig: ExperimentConfig | null;
  onUpdate: (config: Partial<ExperimentConfig>) => void;
}) {
  return (
    <Card size="md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <CardTitle>청킹 실험 설정</CardTitle>
        </div>
        <CardDescription>
          문서 청킹 전략을 설정하고 A/B 테스트를 실행합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 전략 선택 */}
        <div className="space-y-2">
          <Label>청킹 전략</Label>
          <Select
            value={experimentConfig?.chunkingStrategy ?? 'auto'}
            onValueChange={(value) => onUpdate({ chunkingStrategy: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">자동 (환경변수 기반)</SelectItem>
              <SelectItem value="smart">규칙 기반 (Smart Chunk)</SelectItem>
              <SelectItem value="semantic">AI 의미 기반 (Semantic)</SelectItem>
              <SelectItem value="late">Late Chunking</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* A/B 테스트 토글 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>A/B 테스트</Label>
            <p className="text-sm text-muted-foreground">
              두 전략을 비교 테스트합니다
            </p>
          </div>
          <Switch
            checked={experimentConfig?.abTestEnabled ?? false}
            onCheckedChange={(checked) => onUpdate({ abTestEnabled: checked })}
          />
        </div>

        {/* 트래픽 비율 슬라이더 (A/B 활성화 시) */}
        {experimentConfig?.abTestEnabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Semantic 트래픽 비율</Label>
              <span className="text-sm text-muted-foreground">
                {experimentConfig?.semanticTrafficPercent ?? 50}%
              </span>
            </div>
            <Slider
              value={[experimentConfig?.semanticTrafficPercent ?? 50]}
              onValueChange={([value]) => onUpdate({ semanticTrafficPercent: value })}
              min={0}
              max={100}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              {100 - (experimentConfig?.semanticTrafficPercent ?? 50)}% 규칙 기반 /
              {experimentConfig?.semanticTrafficPercent ?? 50}% AI 의미 기반
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 3.2 품질 대시보드 카드

**파일**: `app/(console)/console/dashboard/_components/quality-metrics-card.tsx` (신규)

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { QualityIndicator, QualityBadge } from '@/app/(console)/console/chatbot/_components/quality-indicator';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ABTestResult, QualityMetrics } from '@/types/experiment';

interface QualityMetricsCardProps {
  chatbotId: string;
}

export function QualityMetricsCard({ chatbotId }: QualityMetricsCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['quality-metrics', chatbotId],
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${chatbotId}/quality-metrics`);
      return res.json() as Promise<{
        metrics: QualityMetrics[];
        abTestResult: ABTestResult | null;
      }>;
    },
  });

  if (isLoading) {
    return <QualityMetricsCardSkeleton />;
  }

  const { metrics, abTestResult } = data ?? { metrics: [], abTestResult: null };

  return (
    <Card size="md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>청킹 품질 메트릭</CardTitle>
        </div>
        <CardDescription>
          전략별 청크 품질 점수 및 A/B 테스트 결과
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 전략별 메트릭 */}
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.map((metric) => (
            <StrategyMetricCard key={`${metric.strategy}-${metric.variant}`} metric={metric} />
          ))}
        </div>

        {/* A/B 테스트 결과 */}
        {abTestResult && <ABTestResultCard result={abTestResult} />}
      </CardContent>
    </Card>
  );
}

function StrategyMetricCard({ metric }: { metric: QualityMetrics }) {
  const label = metric.variant
    ? `${metric.strategy} (${metric.variant === 'control' ? '대조군' : '처리군'})`
    : metric.strategy;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <QualityBadge score={metric.avgQualityScore} size="sm" />
      </div>
      <QualityIndicator score={metric.avgQualityScore} />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{metric.totalChunks.toLocaleString()} 청크</span>
        <span>자동승인 {(metric.autoApprovedRate * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ABTestResultCard({ result }: { result: ABTestResult }) {
  const TrendIcon = result.qualityDelta > 0
    ? TrendingUp
    : result.qualityDelta < 0
    ? TrendingDown
    : Minus;

  const trendColor = result.qualityDelta > 0
    ? 'text-green-500'
    : result.qualityDelta < 0
    ? 'text-destructive'
    : 'text-muted-foreground';

  const recommendationText = {
    adopt_treatment: '✅ Semantic 전략 채택 권장',
    keep_control: '⚪ 현재 전략 유지 권장',
    need_more_data: '⏳ 더 많은 데이터 필요 (최소 100개/그룹)',
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <h4 className="text-sm font-medium mb-3">A/B 테스트 분석</h4>

      <div className="flex items-center gap-2 mb-2">
        <TrendIcon className={`h-5 w-5 ${trendColor}`} />
        <span className={`text-lg font-semibold ${trendColor}`}>
          {result.qualityDelta > 0 ? '+' : ''}{result.qualityDelta.toFixed(2)}점
        </span>
        <span className="text-sm text-muted-foreground">
          ({result.qualityDeltaPercent > 0 ? '+' : ''}{result.qualityDeltaPercent.toFixed(1)}%)
        </span>
      </div>

      <p className="text-sm">
        {recommendationText[result.recommendation]}
      </p>

      {!result.isSignificant && result.recommendation !== 'need_more_data' && (
        <p className="text-xs text-muted-foreground mt-1">
          * 통계적으로 유의미한 차이 없음
        </p>
      )}
    </div>
  );
}

function QualityMetricsCardSkeleton() {
  return (
    <Card size="md">
      <CardHeader>
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-24 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}
```

### 3.3 대시보드 통합

**파일**: `app/(console)/console/dashboard/page.tsx`

```tsx
import { QualityMetricsCard } from './_components/quality-metrics-card';

export default async function DashboardPage() {
  const chatbot = await getCurrentChatbot();

  return (
    <div className="space-y-6 p-6">
      {/* 기존 대시보드 카드들 */}

      {/* 품질 메트릭 카드 추가 */}
      <QualityMetricsCard chatbotId={chatbot.id} />
    </div>
  );
}
```

---

## 파일 구조

### 신규 파일

```
types/
└── experiment.ts                    # 실험 관련 타입 정의

lib/rag/
├── experiment.ts                    # 전략 결정 로직
└── quality-metrics.ts               # 품질 집계 함수

app/api/chatbots/[id]/
└── quality-metrics/
    └── route.ts                     # 품질 통계 API

app/(console)/console/dashboard/_components/
└── quality-metrics-card.tsx         # 품질 대시보드 카드
```

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `drizzle/schema.ts` | experimentConfig 필드 추가 |
| `app/api/chatbots/[id]/route.ts` | experimentConfig Zod 스키마 추가 |
| `inngest/functions/process-document.ts` | 전략 분기 로직 통합 |
| `app/(console)/console/chatbot/ai/page.tsx` | 실험 설정 UI 섹션 |
| `app/(console)/console/dashboard/page.tsx` | 품질 카드 추가 |

---

## 검증 계획

### 단위 테스트

| 파일 | 테스트 항목 |
|------|------------|
| `lib/rag/experiment.test.ts` | - `determineChunkingStrategy()` 분기 로직<br>- experimentConfig null → 글로벌 설정<br>- A/B 테스트 트래픽 분배 |
| `lib/rag/quality-metrics.test.ts` | - `getQualityMetricsByStrategy()` 집계<br>- `analyzeABTest()` 분석 로직 |

### 통합 테스트

| 항목 | 검증 내용 |
|------|----------|
| API | PATCH 저장 → GET 조회 일관성 |
| 파이프라인 | 문서 업로드 → 전략 분기 → 메타데이터 저장 |
| 통계 | 청크 생성 → 품질 집계 정확성 |

### 성공 기준

| 메트릭 | 목표 |
|--------|------|
| 전략 분기 정확도 | 100% |
| A/B 트래픽 분배 오차 | ±5% |
| 품질 집계 쿼리 시간 | <500ms |
| UI 로딩 시간 | <1s |

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 스키마 마이그레이션 충돌 | 중간 | experimentConfig은 nullable jsonb, 기존 데이터 영향 없음 |
| A/B 테스트 편향 | 낮음 | 문서 ID 기반 해싱으로 일관된 분배 (추후 개선) |
| 통계적 유의성 부족 | 낮음 | 최소 샘플 100개 필요 안내 UI |
| 기존 코드 호환성 | 낮음 | experimentConfig null이면 기존 글로벌 설정 사용 |
| 집계 쿼리 성능 | 중간 | 인덱스 추가, 날짜 범위 제한 |

---

## 참고 자료

### 내부 문서

- [AI Semantic Chunking 도입 문서](../updates/2026-01-10-ai-semantic-chunking.md)
- [RAG 청킹 트렌드 리서치](../research/semantic-chunking-research.md)
- [구현 계획서](../plans/ai-semantic-chunking-implementation.md)

### 코드 참조

| 파일 | 라인 | 설명 |
|------|------|------|
| `lib/rag/semantic-chunking.ts` | 289-291 | `isSemanticChunkingEnabled()` |
| `lib/rag/chunking.ts` | 712-819 | `calculateQualityScore()` |
| `lib/rag/semantic-chunking.ts` | 341-366 | `calculateSemanticQualityScore()` |
| `app/(console)/console/chatbot/_components/quality-indicator.tsx` | - | 품질 UI 컴포넌트 |

### 외부 참고 자료

- [Anthropic - Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [A/B Testing Best Practices](https://www.optimizely.com/optimization-glossary/ab-testing/)

---

## 다음 단계

Phase 5 완료 후 고려할 추가 개선 사항:

- [ ] 통계적 유의성 검정 (t-test, chi-squared)
- [ ] 문서 ID 기반 일관된 A/B 분배
- [ ] 실험 기간 자동 종료 및 알림
- [ ] 품질 점수 시계열 차트
- [ ] 전략별 비용 분석 대시보드

---

## 문의

구현 관련 질문이나 이슈는 Slack #dev-sofa 채널 또는 이 문서 담당자에게 문의하세요.
