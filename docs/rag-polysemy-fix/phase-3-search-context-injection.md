# Phase 3: 검색 컨텍스트 주입

## 개요

Phase 3에서는 하이브리드 검색 함수에 도메인 컨텍스트를 주입하여 검색 정확도를 향상시킵니다.

### 문제점

현재 검색 시스템은 쿼리를 그대로 임베딩하여 검색합니다:

```typescript
// 현재 방식
const queryEmbedding = await embed("포수 기법", { ... });
```

이 경우 "포수"라는 단어가 야구의 포수인지, 옻칠의 포수(布手) 기법인지 구분할 수 없어 검색 정확도가 저하됩니다.

### 해결 방안

검색 쿼리에 도메인 컨텍스트 프리픽스를 주입하여 임베딩 모델이 올바른 맥락을 파악하도록 합니다:

```typescript
// 개선된 방식
const enrichedQuery = "[옻칠 기법] 포수 기법";
const queryEmbedding = await embed(enrichedQuery, { ... });
```

---

## 수정 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `lib/rag/retrieval.ts` | 수정 | `injectDomainContext()` 함수 추가, 검색 함수 시그니처 확장 |
| `lib/chat/service.ts` | 수정 | 검색 호출 시 도메인 컨텍스트 전달 |

---

## 코드 변경 상세

### 1. `lib/rag/retrieval.ts` - 도메인 컨텍스트 타입 및 유틸리티

```typescript
/**
 * 도메인 컨텍스트 타입
 */
export interface DomainContext {
  /** 전문 분야 (프리픽스로 사용) */
  expertiseArea?: string;
}

/**
 * 검색 쿼리에 도메인 컨텍스트 주입
 * 임베딩 생성 시 도메인 맥락이 반영되도록 함
 *
 * @param query - 원본 검색 쿼리
 * @param domainContext - 도메인 컨텍스트 (expertiseArea 포함)
 * @returns 도메인 컨텍스트가 주입된 쿼리
 *
 * @example
 * injectDomainContext("포수 기법", { expertiseArea: "옻칠 기법" })
 * // => "[옻칠 기법] 포수 기법"
 *
 * @example
 * injectDomainContext("포수 기법", undefined)
 * // => "포수 기법" (변경 없음)
 */
export function injectDomainContext(
  query: string,
  domainContext?: DomainContext
): string {
  if (!domainContext?.expertiseArea) return query;
  return `[${domainContext.expertiseArea}] ${query}`;
}
```

### 2. `lib/rag/retrieval.ts` - hybridSearchMultiDataset 시그니처 확장

```typescript
/**
 * 다중 데이터셋 하이브리드 검색
 *
 * @param tenantId - 테넌트 ID
 * @param datasetIds - 검색 대상 데이터셋 ID 배열
 * @param query - 검색 쿼리
 * @param limit - 결과 제한 (기본값: DEFAULT_LIMIT)
 * @param trackingContext - 임베딩 추적 컨텍스트
 * @param domainContext - 도메인 컨텍스트 (신규)
 */
export async function hybridSearchMultiDataset(
  tenantId: string,
  datasetIds: string[],
  query: string,
  limit: number = DEFAULT_LIMIT,
  trackingContext?: EmbeddingTrackingContext,
  domainContext?: DomainContext  // 신규 파라미터
): Promise<SearchResult[]> {
  // 도메인 컨텍스트 주입
  const enrichedQuery = injectDomainContext(query, domainContext);

  logger.debug('Search with domain context', {
    originalQuery: query,
    enrichedQuery,
    hasDomainContext: !!domainContext?.expertiseArea,
  });

  // 쿼리 임베딩 생성 (enrichedQuery 사용)
  const queryEmbedding = await embed(enrichedQuery, {
    tenantId: trackingContext?.tenantId,
    chatbotId: trackingContext?.chatbotId,
    conversationId: trackingContext?.conversationId,
    featureType: trackingContext?.featureType,
  });

  // ... 기존 검색 로직 (변경 없음)
}
```

### 3. `lib/rag/retrieval.ts` - searchWithKnowledgePages 시그니처 확장

```typescript
/**
 * 지식 페이지 기반 검색
 *
 * @param tenantId - 테넌트 ID
 * @param chatbotId - 챗봇 ID
 * @param query - 검색 쿼리
 * @param limit - 결과 제한
 * @param trackingContext - 임베딩 추적 컨텍스트
 * @param domainContext - 도메인 컨텍스트 (신규)
 */
export async function searchWithKnowledgePages(
  tenantId: string,
  chatbotId: string,
  query: string,
  limit?: number,
  trackingContext?: EmbeddingTrackingContext,
  domainContext?: DomainContext  // 신규 파라미터
): Promise<SearchResult[]> {
  // 도메인 컨텍스트 주입
  const enrichedQuery = injectDomainContext(query, domainContext);

  // ... 기존 로직에서 enrichedQuery 사용
}
```

### 4. `lib/chat/service.ts` - 검색 호출 수정

```typescript
// hybridSearchMultiDataset 호출 시 도메인 컨텍스트 전달
let searchResults = await hybridSearchMultiDataset(
  tenantId,
  datasetIds,
  searchQuery,
  initialSearchLimit,
  {
    tenantId,
    chatbotId: chatbotId ?? undefined,
    conversationId: conversation.id,
    featureType: 'search',
  },
  // 신규: 도메인 컨텍스트 전달
  {
    expertiseArea: persona.expertiseArea,
  }
);

// searchWithKnowledgePages 호출도 동일하게 수정
let searchResults = await searchWithKnowledgePages(
  tenantId,
  chatbotId,
  searchQuery,
  initialSearchLimit,
  {
    tenantId,
    chatbotId: chatbotId ?? undefined,
    conversationId: conversation.id,
    featureType: 'search',
  },
  // 신규: 도메인 컨텍스트 전달
  {
    expertiseArea: persona.expertiseArea,
  }
);
```

---

## 예상 효과

도메인 프리픽스가 추가되면 임베딩 모델이 해당 맥락에서 더 적절한 벡터를 생성합니다.

| 쿼리 | 기존 임베딩 입력 | 개선 후 임베딩 입력 |
|------|-----------------|-------------------|
| "포수 기법" | "포수 기법" | "[옻칠 기법] 포수 기법" |
| "생칠이 뭐야?" | "생칠이 뭐야?" | "[옻칠 기법] 생칠이 뭐야?" |
| "리벤지 전략" | "리벤지 전략" | "[야구 전략] 리벤지 전략" |

### 임베딩 벡터 변화

```
기존: embed("포수")
  → 야구 포수(catcher)와 옻칠 포수(布手) 의미가 혼재된 벡터

개선: embed("[옻칠 기법] 포수")
  → 옻칠 맥락의 포수(布手) 의미에 특화된 벡터
```

---

## 체크리스트

### 구현

- [ ] `DomainContext` 인터페이스 정의
- [ ] `injectDomainContext()` 함수 구현
- [ ] `hybridSearchMultiDataset()` 시그니처 확장
- [ ] `searchWithKnowledgePages()` 시그니처 확장
- [ ] `service.ts`에서 도메인 컨텍스트 전달

### 검증

- [ ] 기존 테스트 통과 확인
- [ ] 도메인 컨텍스트 없는 호출 하위 호환성 확인
- [ ] 로그에서 enrichedQuery 확인

### 문서화

- [ ] JSDoc 주석 추가
- [ ] 사용 예시 문서화

---

## 테스트 방법

### 1. 단위 테스트

```typescript
// __tests__/lib/rag/retrieval.test.ts

describe('injectDomainContext', () => {
  it('도메인 컨텍스트가 있으면 프리픽스를 추가한다', () => {
    const result = injectDomainContext('포수 기법', {
      expertiseArea: '옻칠 기법'
    });
    expect(result).toBe('[옻칠 기법] 포수 기법');
  });

  it('도메인 컨텍스트가 없으면 원본을 반환한다', () => {
    const result = injectDomainContext('포수 기법', undefined);
    expect(result).toBe('포수 기법');
  });

  it('expertiseArea가 빈 문자열이면 원본을 반환한다', () => {
    const result = injectDomainContext('포수 기법', {
      expertiseArea: ''
    });
    expect(result).toBe('포수 기법');
  });
});
```

### 2. 통합 테스트

```typescript
describe('hybridSearchMultiDataset with domain context', () => {
  it('도메인 컨텍스트가 검색 결과에 영향을 미친다', async () => {
    // 동일 쿼리, 다른 도메인 컨텍스트로 검색
    const resultsWithContext = await hybridSearchMultiDataset(
      tenantId,
      datasetIds,
      '포수',
      10,
      undefined,
      { expertiseArea: '옻칠 기법' }
    );

    const resultsWithoutContext = await hybridSearchMultiDataset(
      tenantId,
      datasetIds,
      '포수',
      10,
      undefined,
      undefined
    );

    // 결과가 다름을 확인
    expect(resultsWithContext).not.toEqual(resultsWithoutContext);
  });
});
```

### 3. 수동 테스트

1. 개발 서버 실행: `pnpm dev`
2. 옻칠 전문 챗봇에서 "포수 기법이 뭐야?" 질문
3. 로그 확인:
   ```
   Search with domain context {
     originalQuery: "포수 기법이 뭐야?",
     enrichedQuery: "[옻칠 기법] 포수 기법이 뭐야?",
     hasDomainContext: true
   }
   ```
4. 검색 결과가 옻칠 관련 문서를 반환하는지 확인

---

## 의존성

### Phase 2 완료 필요

Phase 3는 `persona.expertiseArea` 필드를 사용하므로 Phase 2(페르소나 스키마 확장)가 완료되어야 합니다.

```typescript
// Phase 2에서 추가된 필드
interface Persona {
  // ...
  expertiseArea?: string;  // Phase 2에서 추가
}
```

### 하위 호환성

`domainContext` 파라미터는 optional이므로 기존 호출 코드는 수정 없이 동작합니다.

```typescript
// 기존 호출 - 변경 없이 동작
await hybridSearchMultiDataset(tenantId, datasetIds, query, limit, trackingContext);

// 새 호출 - 도메인 컨텍스트 추가
await hybridSearchMultiDataset(tenantId, datasetIds, query, limit, trackingContext, {
  expertiseArea: 'AI 개발'
});
```

---

## 다음 단계

Phase 3 완료 후 Phase 4(청킹 시 도메인 컨텍스트 주입)로 진행합니다.
