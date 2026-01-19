# Phase 2: Domain-Aware Query Rewriting

## 개요

**목표**: LLM 쿼리 재작성 시 도메인 컨텍스트(전문 분야, 용어 사전)를 전달하여 동음이의어를 올바르게 해석

**문제점**:
- 현재 쿼리 재작성 시 도메인 컨텍스트(`expertiseArea`, `domainGlossary`)가 전달되지 않음
- LLM이 동음이의어를 일반적 의미로 해석할 수 있음
- 히스토리가 없으면 LLM 재작성이 스킵됨 (키워드 확장만 수행)

**해결 방안**:
1. `QueryRewriteOptions`에 `expertiseArea`, `domainGlossary` 추가
2. 도메인 인지 재작성 프롬프트 추가
3. 히스토리 없어도 도메인 컨텍스트가 있으면 LLM 재작성 수행
4. `service.ts`에서 도메인 정보 전달

---

## 수정 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `lib/rag/query-rewriter.ts` | 수정 | 옵션 확장, 도메인 인지 프롬프트 추가 |
| `lib/chat/service.ts` | 수정 | RAG 파이프라인에 도메인 정보 전달 |

---

## 코드 변경 상세

### 1. QueryRewriteOptions 확장

**파일**: `lib/rag/query-rewriter.ts`

```typescript
export interface QueryRewriteOptions {
  /** 사용할 최대 히스토리 메시지 수 (기본: 4) */
  maxHistoryMessages?: number;
  /** LLM temperature (기본: 0.3, 일관성 우선) */
  temperature?: number;
  /** 최대 출력 토큰 수 (기본: 150) */
  maxTokens?: number;
  /** 토큰 사용량 추적을 위한 컨텍스트 */
  trackingContext?: TrackingContext;
  /** 페르소나의 포함 주제 (키워드 확장에 사용) */
  includedTopics?: string[];
  /** [신규] 전문 분야 (도메인 맥락용) */
  expertiseArea?: string;
  /** [신규] 도메인 용어 사전 (동음이의어 해소용) */
  domainGlossary?: Record<string, string>;
}
```

---

### 2. 도메인 인지 프롬프트 빌더 함수

**파일**: `lib/rag/query-rewriter.ts`

```typescript
/**
 * 도메인 컨텍스트를 반영한 시스템 프롬프트 생성
 * 도메인 정보가 없으면 기존 프롬프트 반환
 */
function buildDomainAwarePrompt(options: QueryRewriteOptions): string {
  const { expertiseArea, includedTopics, domainGlossary } = options;

  // 도메인 정보가 없으면 기존 프롬프트 사용
  if (!expertiseArea && !includedTopics?.length && !domainGlossary) {
    return REWRITE_SYSTEM_PROMPT;
  }

  const glossarySection = domainGlossary
    ? Object.entries(domainGlossary)
        .map(([term, def]) => `- ${term}: ${def}`)
        .join('\n')
    : '';

  return `당신은 대화 맥락을 고려하여 질문을 재작성하는 전문가입니다.

## 도메인 정보
- 전문 분야: ${expertiseArea || '일반'}
- 관련 주제: ${includedTopics?.join(', ') || '없음'}
${glossarySection ? `\n## 도메인 용어 사전\n${glossarySection}` : ''}

## 동음이의어 처리 규칙
- 질문에 도메인 주제와 관련된 단어가 있다면, 반드시 도메인 맥락에서 해석하세요.
- 도메인 용어 사전에 있는 용어는 해당 정의에 따라 재작성하세요.
- 예시: "포수"가 옻칠 관련 챗봇이면 "옻칠 포수(布水) 기법"으로 재작성

## 규칙
1. 대명사를 구체적 명사로 교체
2. 생략된 맥락 정보를 명시적으로 포함
3. 도메인 컨텍스트를 반영하여 재작성
4. 재작성된 질문만 출력 (설명, 인용부호 없이)`;
}
```

---

### 3. rewriteQuery 함수 수정

**파일**: `lib/rag/query-rewriter.ts`

**변경 전**:
```typescript
export async function rewriteQuery(
  currentQuery: string,
  conversationHistory: ChatMessage[],
  options: QueryRewriteOptions = {}
): Promise<string> {
  const {
    maxHistoryMessages = 4,
    temperature = 0.3,
    maxTokens = 150,
    trackingContext,
    includedTopics,
  } = options;

  // 1. 키워드 확장
  let expandedQuery = expandQueryWithKeywords(currentQuery, includedTopics || []);

  // 2. 대화 히스토리가 없으면 확장된 쿼리 반환
  if (conversationHistory.length === 0) {
    return expandedQuery;
  }

  // ... LLM 재작성 로직
}
```

**변경 후**:
```typescript
export async function rewriteQuery(
  currentQuery: string,
  conversationHistory: ChatMessage[],
  options: QueryRewriteOptions = {}
): Promise<string> {
  const {
    maxHistoryMessages = 4,
    temperature = 0.3,
    maxTokens = 150,
    trackingContext,
    includedTopics,
    expertiseArea,      // 신규
    domainGlossary,     // 신규
  } = options;

  // 1. 키워드 확장
  let expandedQuery = expandQueryWithKeywords(currentQuery, includedTopics || []);

  // 2. 도메인 컨텍스트가 있거나 히스토리가 있으면 LLM 재작성
  const hasDomainContext = !!(expertiseArea || (domainGlossary && Object.keys(domainGlossary).length > 0));
  if (conversationHistory.length === 0 && !hasDomainContext) {
    return expandedQuery;
  }

  try {
    const systemPrompt = buildDomainAwarePrompt(options);

    // 히스토리가 없는 경우 (도메인 컨텍스트만 있는 경우)
    const userPrompt = conversationHistory.length === 0
      ? `다음 질문을 도메인 맥락에 맞게 재작성하세요:\n\n질문: ${expandedQuery}`
      : buildUserPrompt(expandedQuery, conversationHistory, maxHistoryMessages);

    // ... 기존 LLM 호출 로직 (systemPrompt 사용)
  } catch (error) {
    logger.warn('[QueryRewriter] LLM rewrite failed, using expanded query', { error });
    return expandedQuery;
  }
}
```

---

### 4. service.ts 수정

**파일**: `lib/chat/service.ts`

**변경 전**:
```typescript
searchQuery = await rewriteQuery(request.message, contextMessages, {
  maxHistoryMessages: historyLimit,
  temperature: 0.3,
  maxTokens: 150,
  trackingContext: {
    chatbotId: chatbot.id,
    conversationId: request.conversationId || 'unknown',
    model: 'query-rewriter',
  },
  includedTopics: persona.includedTopics,
});
```

**변경 후**:
```typescript
searchQuery = await rewriteQuery(request.message, contextMessages, {
  maxHistoryMessages: historyLimit,
  temperature: 0.3,
  maxTokens: 150,
  trackingContext: {
    chatbotId: chatbot.id,
    conversationId: request.conversationId || 'unknown',
    model: 'query-rewriter',
  },
  includedTopics: persona.includedTopics,
  expertiseArea: persona.expertiseArea,        // 신규
  domainGlossary: persona.domainGlossary,      // 신규
});
```

---

## 동작 흐름

### 히스토리 없음 + 도메인 컨텍스트 없음
```
"포수에 대해 알려줘"
    ↓
expandQueryWithKeywords()
    ↓
히스토리 없음 && 도메인 없음 → 확장 쿼리 반환
    ↓
"포수에 대해 알려줘" (변경 없음)
```

### 히스토리 없음 + 도메인 컨텍스트 있음
```
"포수에 대해 알려줘"
    ↓
expandQueryWithKeywords()
    ↓
히스토리 없음 BUT 도메인 있음 → LLM 재작성
    ↓
buildDomainAwarePrompt() → 도메인 인지 프롬프트
    ↓
LLM: "옻칠 포수(布水) 기법에 대해 알려줘"
```

### 히스토리 있음 + 도메인 컨텍스트 있음
```
[히스토리] "옻칠에 대해 알려줘" → "옻칠은..."
"포수는 어떻게 해?" (현재 질문)
    ↓
expandQueryWithKeywords()
    ↓
히스토리 있음 → LLM 재작성
    ↓
buildDomainAwarePrompt() → 도메인 인지 프롬프트 + 히스토리
    ↓
LLM: "옻칠에서 포수(布水) 기법은 어떻게 수행하나요?"
```

---

## 의존성

| 의존 항목 | 설명 |
|----------|------|
| Phase 4 (PersonaConfig 확장) | `expertiseArea`, `domainGlossary` 필드가 PersonaConfig에 추가되어야 함 |

**권장 구현 순서**: Phase 1 → Phase 4 → **Phase 2** → Phase 3

---

## 체크리스트

- [ ] `QueryRewriteOptions` 인터페이스에 `expertiseArea`, `domainGlossary` 추가
- [ ] `buildDomainAwarePrompt()` 함수 구현
- [ ] `rewriteQuery()` 함수 조건문 수정 (도메인 컨텍스트 체크)
- [ ] `service.ts`에서 persona 도메인 정보 전달
- [ ] 히스토리 없는 경우 userPrompt 분기 처리
- [ ] 로깅 추가 (도메인 인지 재작성 여부)

---

## 테스트 방법

### 단위 테스트

```typescript
// lib/rag/__tests__/query-rewriter.test.ts

describe('rewriteQuery with domain context', () => {
  it('should rewrite polysemous term with domain context', async () => {
    const query = '포수에 대해 알려줘';
    const history: ChatMessage[] = [];
    const options: QueryRewriteOptions = {
      expertiseArea: '옻칠 기법 안내',
      domainGlossary: {
        '포수': '布水, 옻칠 마감 기법으로 물을 뿌려 광택을 내는 과정',
      },
    };

    const result = await rewriteQuery(query, history, options);

    // LLM이 도메인 맥락을 반영하여 재작성
    expect(result).toContain('옻칠');
    expect(result).not.toContain('야구');
  });

  it('should skip LLM rewrite when no history and no domain context', async () => {
    const query = '포수에 대해 알려줘';
    const history: ChatMessage[] = [];
    const options: QueryRewriteOptions = {};

    const result = await rewriteQuery(query, history, options);

    // 키워드 확장만 수행, LLM 호출 없음
    expect(result).toBe(query);
  });

  it('should use domain-aware prompt when domain context exists', async () => {
    const options: QueryRewriteOptions = {
      expertiseArea: '옻칠 기법',
      includedTopics: ['옻칠', '포수', '생칠'],
      domainGlossary: {
        '포수': '布水, 옻칠 마감 기법',
      },
    };

    const prompt = buildDomainAwarePrompt(options);

    expect(prompt).toContain('도메인 정보');
    expect(prompt).toContain('옻칠 기법');
    expect(prompt).toContain('포수: 布水');
  });
});
```

### 통합 테스트

```typescript
// 실제 챗봇으로 테스트
const testCases = [
  {
    input: '포수에 대해 알려줘',
    persona: ottchilPersona,
    expected: {
      rewrittenQueryContains: '옻칠',
      notContains: '야구',
    },
  },
  {
    input: '생칠이 뭐야?',
    persona: ottchilPersona,
    expected: {
      rewrittenQueryContains: '옻칠',
    },
  },
];
```

### 수동 테스트

1. 옻칠 전문 페르소나 설정:
   - `expertiseArea`: "옻칠 기법 안내"
   - `domainGlossary`: `{ "포수": "布水, 옻칠 마감 기법" }`

2. 테스트 질문:
   - "포수에 대해 알려줘" → 옻칠 포수 관련 응답 확인
   - "생칠이 뭐야?" → 생칠 관련 응답 확인

3. 로그 확인:
   ```
   [QueryRewriter] Domain-aware rewrite applied
   - original: "포수에 대해 알려줘"
   - rewritten: "옻칠 포수(布水) 기법에 대해 알려줘"
   - hasDomainContext: true
   ```

---

## 비용 영향

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| LLM 호출 빈도 | 히스토리 있을 때만 | 히스토리 없어도 도메인 컨텍스트 있으면 호출 |
| 프롬프트 토큰 | 기본 프롬프트 (~100 토큰) | 도메인 프롬프트 (~200-300 토큰) |
| 예상 추가 비용 | - | 미미함 (첫 질문에서만 추가 호출) |

**비용 최적화**:
- 도메인 컨텍스트가 있을 때만 확장 프롬프트 사용
- `domainGlossary`가 비어있으면 해당 섹션 생략
- 캐싱 고려 (동일 쿼리 + 동일 도메인 → 캐시)

---

## 롤백 계획

문제 발생 시:
1. `service.ts`에서 `expertiseArea`, `domainGlossary` 전달 제거
2. `rewriteQuery()` 조건문을 원래대로 복원

```typescript
// 롤백: 기존 조건문으로 복원
if (conversationHistory.length === 0) {
  return expandedQuery;
}
```

---

*문서 작성일: 2026-01-19*
*상태: 구현 대기*
*의존성: Phase 4 (PersonaConfig 확장)*
