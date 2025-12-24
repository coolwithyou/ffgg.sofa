# 개발 계획 검토 및 개선사항

## 1. 검토 결과 요약

개발 계획을 전반적으로 검토한 결과, 핵심 아키텍처와 기술 스택은 적절하나 다음 영역에서 개선이 필요합니다.

---

## 2. 식별된 개선사항

### 2.1 아키텍처 관련

#### 문제 1: 캐싱 전략 부재
**현재 상태**: 모든 RAG 쿼리가 매번 벡터 검색 + LLM 호출을 수행
**영향**: 동일/유사 질문에 대한 불필요한 비용 발생, 응답 지연
**개선안**:
```typescript
// 추가 필요: lib/cache/query-cache.ts
// Redis 또는 Upstash를 활용한 쿼리-응답 캐싱
// - 정확히 동일한 질문: 캐시된 응답 반환
// - 유사 질문 (임베딩 유사도 > 0.95): 캐시된 응답 재사용 고려
```

#### 문제 2: 청크 버전 관리 미흡
**현재 상태**: 문서 재업로드 시 기존 청크 처리 방식 불명확
**영향**: 롤백 불가, 변경 이력 추적 어려움
**개선안**:
```sql
-- chunks 테이블에 버전 관리 추가
ALTER TABLE chunks ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE chunks ADD COLUMN is_active BOOLEAN DEFAULT true;

-- 또는 별도의 chunk_versions 테이블 생성
CREATE TABLE chunk_versions (
  id UUID PRIMARY KEY,
  chunk_id UUID REFERENCES chunks(id),
  content TEXT,
  embedding vector(1536),
  version INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 성능 최적화

#### 문제 3: 임베딩 생성 병목
**현재 상태**: 청크별 순차 임베딩 생성
**영향**: 대용량 문서 처리 시간 증가
**개선안**:
```typescript
// 배치 임베딩으로 변경
async function generateEmbeddingsBatch(chunks: string[]): Promise<number[][]> {
  // OpenAI API는 한 번에 최대 2048개 텍스트 처리 가능
  const batchSize = 100;
  const results = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch
    });
    results.push(...embeddings.data.map(e => e.embedding));
  }

  return results;
}
```

#### 문제 4: pgvector 인덱스 최적화
**현재 상태**: IVFFlat 인덱스 사용 (lists = 100 고정)
**영향**: 데이터 증가 시 검색 성능 저하
**개선안**:
```sql
-- 데이터 규모에 따른 동적 lists 값 설정
-- 권장: sqrt(총 행 수)
-- 초기: lists = 100 (10,000개 청크까지)
-- 확장: HNSW 인덱스 고려 (더 나은 성능, 더 많은 메모리)

CREATE INDEX idx_chunks_embedding_hnsw ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 2.3 사용자 경험

#### 문제 5: 고객 포털 진행 상태 불명확
**현재 상태**: 단순 상태 텍스트만 표시
**영향**: 고객이 언제 완료되는지 알 수 없음
**개선안**:
- 예상 완료 시간 표시
- 처리 단계별 진행률 (파싱 → 청킹 → 임베딩 → 검토 대기)
- 실시간 업데이트 (Supabase Realtime 활용)

```typescript
// 실시간 상태 업데이트
const channel = supabase
  .channel('document-status')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents',
    filter: `id=eq.${documentId}`
  }, (payload) => {
    setStatus(payload.new.status);
  })
  .subscribe();
```

#### 문제 6: 챗봇 테스트 환경 미흡
**현재 상태**: 배포 전 테스트만 가능
**영향**: A/B 테스트, 프롬프트 실험 어려움
**개선안**:
- 테스트 모드 / 프로덕션 모드 분리
- 다양한 프롬프트 템플릿 테스트 기능
- 예상 질문-답변 시뮬레이션

### 2.4 운영 효율성

#### 문제 7: 청킹 검토 워크플로우 개선
**현재 상태**: 모든 청크를 수동 검토
**영향**: 고객 증가 시 운영 부담 급증
**개선안**:
```typescript
// 품질 점수 기반 자동 승인 로직
async function autoApproveChunks(documentId: string) {
  const chunks = await getChunksByDocument(documentId);

  for (const chunk of chunks) {
    if (chunk.qualityScore >= 85) {
      await updateChunkStatus(chunk.id, 'approved');
    } else if (chunk.qualityScore >= 70) {
      // 검토 권장, 자동 승인 가능
      await updateChunkStatus(chunk.id, 'review_recommended');
    } else {
      // 필수 검토
      await updateChunkStatus(chunk.id, 'review_required');
    }
  }
}
```

#### 문제 8: 알림 시스템 체계화
**현재 상태**: 단순 이메일 알림만 구현
**영향**: 긴급 상황 대응 지연
**개선안**:
- 긴급도별 알림 채널 분리 (이메일/Slack/SMS)
- 알림 임계값 설정 (에러율 > 5%, 응답시간 > 4초 등)
- 일일/주간 리포트 자동 발송

### 2.5 비즈니스 로직

#### 문제 9: 사용량 제한 및 과금 로직 미비
**현재 상태**: 무제한 사용, 수동 과금
**영향**: 비용 폭발 리스크, 과금 분쟁 가능성
**개선안**:
```typescript
// 사용량 체크 미들웨어
async function checkUsageLimit(tenantId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const usage = await getUsageLog(tenantId, today);

  const limits = await getTenantLimits(tenantId);

  if (usage.messageCount >= limits.dailyMessages) {
    throw new UsageLimitError('일일 메시지 한도에 도달했습니다.');
  }

  return true;
}

// 티어별 기본 한도
const TIER_LIMITS = {
  basic: { dailyMessages: 500, monthlyTokens: 1_000_000 },
  standard: { dailyMessages: 2000, monthlyTokens: 5_000_000 },
  premium: { dailyMessages: 10000, monthlyTokens: 20_000_000 }
};
```

#### 문제 10: 멀티 문서 지원 고려
**현재 상태**: 문서별 독립 처리
**영향**: 여러 문서 간 컨텍스트 활용 어려움
**개선안**:
- 문서 간 교차 참조 지원
- 문서 그룹/카테고리 기능
- 메타데이터 기반 필터링 검색

---

## 3. 추가 권장사항

### 3.1 테스트 전략 추가
현재 계획에 테스트 관련 내용이 없음.

```
추가 필요:
- Unit 테스트: 청킹 알고리즘, 품질 점수 계산
- Integration 테스트: RAG 파이프라인, API 엔드포인트
- E2E 테스트: 핵심 사용자 플로우 (Playwright)
```

### 3.2 에러 처리 표준화
```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class UsageLimitError extends AppError {
  constructor(message: string) {
    super(message, 'USAGE_LIMIT', 429);
  }
}
```

### 3.3 로깅 표준화
```typescript
// lib/logger.ts
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: 'rag-chatbot' },
  transports: [
    new transports.Console()
  ]
});

// 사용 예
logger.info('Document processed', {
  documentId,
  tenantId,
  chunkCount,
  duration: Date.now() - startTime
});
```

### 3.4 개발 환경 설정
```
추가 필요:
- Docker Compose (로컬 Supabase)
- Seed 데이터 스크립트
- 개발용 Mock 데이터
```

---

## 4. 우선순위별 개선 로드맵

### 즉시 적용 (Week 1-4 내)
1. 배치 임베딩 처리 (성능)
2. 에러 처리 표준화 (안정성)
3. 사용량 제한 로직 (비용 보호)

### MVP 포함 필수 (Week 5-12 내)
4. 청크 자동 승인 로직 (운영 효율)
5. 실시간 상태 업데이트 (UX)
6. 기본 테스트 코드 (품질)

### MVP 이후
7. 쿼리 캐싱 시스템
8. 청크 버전 관리
9. 멀티 문서 교차 검색
10. HNSW 인덱스 전환

---

## 5. 수정된 DB 스키마 (개선사항 반영)

```sql
-- 테넌트에 티어 추가
ALTER TABLE tenants ADD COLUMN tier TEXT DEFAULT 'basic'
  CHECK (tier IN ('basic', 'standard', 'premium'));
ALTER TABLE tenants ADD COLUMN usage_limits JSONB DEFAULT '{}';

-- 청크에 버전 관리 추가
ALTER TABLE chunks ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE chunks ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE chunks ADD COLUMN auto_approved BOOLEAN DEFAULT false;

-- 캐시 테이블 추가
CREATE TABLE response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  query_embedding vector(1536),
  response TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE(tenant_id, query_hash)
);

CREATE INDEX idx_cache_embedding ON response_cache
  USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 50);
```

---

## 6. 결론

개발 계획의 기본 구조는 견고하나, 위 개선사항을 반영하면:

1. **운영 효율성**: 자동 승인으로 검토 시간 50% 이상 단축
2. **비용 관리**: 캐싱 + 사용량 제한으로 예측 가능한 비용
3. **확장성**: 버전 관리 + 인덱스 최적화로 성장 대비
4. **안정성**: 에러 처리 + 테스트로 품질 보장

이 개선사항들은 MVP 범위를 크게 늘리지 않으면서 서비스 품질을 높일 수 있습니다.
