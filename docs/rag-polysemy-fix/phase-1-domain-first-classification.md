# Phase 1: 도메인 우선 분류 (Domain-First Classification)

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | 규칙 기반 Intent 분류에서 도메인 키워드를 OUT_OF_SCOPE 패턴보다 먼저 체크하여 다의어 오분류 방지 |
| **산출물** | `classifyByRules()` 함수 수정 (persona 파라미터 추가, 도메인 우선 체크 로직) |
| **의존성** | 기존 `lib/chat/intent-classifier.ts` |
| **예상 기간** | 0.5일 |

---

## 문제 상황

### 현재 코드의 문제점

```typescript
// lib/chat/intent-classifier.ts (라인 81-109)
function classifyByRules(message: string): IntentResult | null {
  const trimmed = message.trim();

  // 1. CHITCHAT 패턴 체크
  for (const pattern of CHITCHAT_PATTERNS) { ... }

  // 2. OUT_OF_SCOPE 패턴 체크 (여기서 문제 발생!)
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: 'OUT_OF_SCOPE', ... };
    }
  }

  return null;
}
```

**문제 1**: `classifyByRules()`가 `persona` 파라미터를 받지 않음
- `classifyIntent()`에서 persona를 전달하지 않음 (라인 307)
- includedTopics/excludedTopics를 활용할 수 없음

**문제 2**: OUT_OF_SCOPE 패턴이 도메인 키워드보다 먼저 체크됨
- 다의어 "포수"가 야구 관련 패턴에 매칭되어 OUT_OF_SCOPE로 분류
- 실제로는 도메인 주제(캐처 장비)인데 오분류됨

### 재현 케이스

```typescript
// persona.includedTopics = ["포수", "캐처", "야구 장비"]
const message = "포수 미트 종류 알려줘";

// 현재 동작:
// 1. CHITCHAT 패턴 - 미매칭
// 2. OUT_OF_SCOPE 패턴 /야구/ - 매칭! (오분류)
// 결과: { intent: 'OUT_OF_SCOPE' }

// 기대 동작:
// 1. CHITCHAT 패턴 - 미매칭
// 2. includedTopics "포수" - 매칭! (정분류)
// 결과: { intent: 'DOMAIN_QUERY' }
```

---

## 수정 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `lib/chat/intent-classifier.ts` | 수정 | `classifyByRules()` 함수에 persona 파라미터 추가, 도메인 우선 체크 로직 구현 |

---

## 코드 변경 상세

### 1. classifyByRules 함수 시그니처 변경

**변경 전** (라인 81):
```typescript
function classifyByRules(message: string): IntentResult | null {
```

**변경 후**:
```typescript
function classifyByRules(message: string, persona?: PersonaConfig): IntentResult | null {
```

### 2. 도메인 우선 체크 로직 추가

**변경 전** (라인 81-109):
```typescript
function classifyByRules(message: string): IntentResult | null {
  const trimmed = message.trim();

  // CHITCHAT 패턴 체크
  for (const pattern of CHITCHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.95,
        reasoning: `규칙 매칭: ${pattern.source}`,
        rulesMatch: true,
      };
    }
  }

  // OUT_OF_SCOPE 패턴 체크
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: 'OUT_OF_SCOPE',
        confidence: 0.85,
        reasoning: `규칙 매칭: ${pattern.source}`,
        rulesMatch: true,
      };
    }
  }

  return null;
}
```

**변경 후**:
```typescript
function classifyByRules(message: string, persona?: PersonaConfig): IntentResult | null {
  const trimmed = message.trim();

  // 1. CHITCHAT 패턴 체크 (기존 유지)
  for (const pattern of CHITCHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.95,
        reasoning: `규칙 매칭: ${pattern.source}`,
        rulesMatch: true,
      };
    }
  }

  // 2. [신규] 도메인 키워드 우선 체크 (OUT_OF_SCOPE보다 먼저!)
  if (persona?.includedTopics?.length) {
    const messageLower = trimmed.toLowerCase();
    for (const topic of persona.includedTopics) {
      if (messageLower.includes(topic.toLowerCase())) {
        return {
          intent: 'DOMAIN_QUERY',
          confidence: 0.92,
          reasoning: `도메인 주제 "${topic}" 매칭`,
          rulesMatch: true,
        };
      }
    }
  }

  // 3. [신규] excludedTopics 체크
  if (persona?.excludedTopics?.length) {
    const messageLower = trimmed.toLowerCase();
    for (const topic of persona.excludedTopics) {
      if (messageLower.includes(topic.toLowerCase())) {
        return {
          intent: 'OUT_OF_SCOPE',
          confidence: 0.9,
          reasoning: `제외 주제 "${topic}" 매칭`,
          rulesMatch: true,
        };
      }
    }
  }

  // 4. 기존 OUT_OF_SCOPE 패턴 (마지막에)
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: 'OUT_OF_SCOPE',
        confidence: 0.85,
        reasoning: `규칙 매칭: ${pattern.source}`,
        rulesMatch: true,
      };
    }
  }

  return null;
}
```

### 3. classifyIntent 호출부 수정

**변경 전** (라인 307):
```typescript
const rulesResult = classifyByRules(message);
```

**변경 후**:
```typescript
const rulesResult = classifyByRules(message, persona);
```

---

## 변경 흐름 다이어그램

```
classifyByRules(message, persona)
│
├─ 1. CHITCHAT 패턴 체크
│   └─ 매칭 → return { intent: 'CHITCHAT', confidence: 0.95 }
│
├─ 2. [신규] includedTopics 체크 ★ 핵심 변경
│   └─ 매칭 → return { intent: 'DOMAIN_QUERY', confidence: 0.92 }
│
├─ 3. [신규] excludedTopics 체크
│   └─ 매칭 → return { intent: 'OUT_OF_SCOPE', confidence: 0.9 }
│
├─ 4. OUT_OF_SCOPE 패턴 체크 (기존, 순서 변경)
│   └─ 매칭 → return { intent: 'OUT_OF_SCOPE', confidence: 0.85 }
│
└─ 5. 미매칭 → return null (LLM 분류로 진행)
```

---

## Confidence 값 설계

| 분류 유형 | Confidence | 이유 |
|-----------|-----------|------|
| CHITCHAT 패턴 | 0.95 | 명확한 인사/감사 패턴 |
| includedTopics 매칭 | 0.92 | 관리자가 명시적으로 지정한 도메인 키워드 |
| excludedTopics 매칭 | 0.90 | 관리자가 명시적으로 제외한 주제 |
| OUT_OF_SCOPE 패턴 | 0.85 | 일반적인 범위 외 패턴 (다의어 가능성) |

---

## 체크리스트

- [ ] `classifyByRules()` 함수 시그니처에 `persona?: PersonaConfig` 파라미터 추가
- [ ] CHITCHAT 패턴 체크 후 includedTopics 체크 로직 추가
- [ ] excludedTopics 체크 로직 추가 (OUT_OF_SCOPE 패턴 전)
- [ ] OUT_OF_SCOPE 패턴 체크 순서를 마지막으로 이동
- [ ] `classifyIntent()`에서 `classifyByRules(message, persona)` 호출로 변경
- [ ] TypeScript 타입 체크 통과 (`pnpm typecheck`)
- [ ] 기존 테스트 통과 확인

---

## 테스트 방법

### 1. 수동 테스트 케이스

```typescript
// 테스트 시나리오 1: 다의어 도메인 키워드
const persona: PersonaConfig = {
  name: '야구 장비 전문가',
  expertiseArea: '야구 장비',
  includedTopics: ['포수', '캐처', '미트', '글러브'],
  excludedTopics: [],
  tone: 'friendly',
};

const testCases = [
  // 포함 주제 테스트
  { message: '포수 미트 추천해줘', expected: 'DOMAIN_QUERY' },
  { message: '캐처 장비 가격대가 어떻게 돼?', expected: 'DOMAIN_QUERY' },

  // OUT_OF_SCOPE 패턴에 걸리지만 도메인 키워드로 우선 분류
  { message: '야구 포수 글러브 관리법', expected: 'DOMAIN_QUERY' }, // "야구" 패턴 무시

  // 제외 주제 테스트 (excludedTopics 설정 시)
  { message: '축구공 추천해줘', expected: 'OUT_OF_SCOPE' },

  // 기존 동작 유지
  { message: '안녕하세요', expected: 'CHITCHAT' },
  { message: 'JavaScript 함수 만드는 법', expected: 'OUT_OF_SCOPE' },
];
```

### 2. 단위 테스트 추가

```typescript
// __tests__/lib/chat/intent-classifier.test.ts

import { classifyIntent, type PersonaConfig } from '@/lib/chat/intent-classifier';

describe('classifyIntent - Domain First Classification', () => {
  const baseballPersona: PersonaConfig = {
    name: '야구 장비 전문가',
    expertiseArea: '야구 장비',
    includedTopics: ['포수', '캐처', '미트', '글러브'],
    excludedTopics: ['축구', '농구'],
    tone: 'friendly',
  };

  it('should classify includedTopics keyword as DOMAIN_QUERY', async () => {
    const result = await classifyIntent('포수 미트 추천해줘', [], baseballPersona);
    expect(result.intent).toBe('DOMAIN_QUERY');
    expect(result.rulesMatch).toBe(true);
    expect(result.reasoning).toContain('포수');
  });

  it('should prioritize includedTopics over OUT_OF_SCOPE pattern', async () => {
    // "야구"는 OUT_OF_SCOPE 패턴에 매칭되지만, "포수"가 includedTopics에 있으므로 DOMAIN_QUERY
    const result = await classifyIntent('야구 포수 장비 알려줘', [], baseballPersona);
    expect(result.intent).toBe('DOMAIN_QUERY');
  });

  it('should classify excludedTopics keyword as OUT_OF_SCOPE', async () => {
    const result = await classifyIntent('축구공 가격 알려줘', [], baseballPersona);
    expect(result.intent).toBe('OUT_OF_SCOPE');
    expect(result.reasoning).toContain('축구');
  });

  it('should still classify CHITCHAT patterns correctly', async () => {
    const result = await classifyIntent('안녕하세요', [], baseballPersona);
    expect(result.intent).toBe('CHITCHAT');
  });

  it('should fall through to OUT_OF_SCOPE patterns when no domain match', async () => {
    const result = await classifyIntent('비트코인 전망 어때?', [], baseballPersona);
    expect(result.intent).toBe('OUT_OF_SCOPE');
    expect(result.reasoning).toContain('규칙 매칭');
  });
});
```

### 3. 통합 테스트

```bash
# 1. TypeScript 타입 체크
pnpm typecheck

# 2. 단위 테스트 실행
pnpm test -- --testPathPattern="intent-classifier"

# 3. 개발 서버에서 실제 챗봇 테스트
pnpm dev
# Console에서 includedTopics 설정 후 채팅 테스트
```

---

## 영향 범위 분석

### 영향받는 파일

| 파일 | 영향 | 설명 |
|------|------|------|
| `lib/chat/intent-classifier.ts` | 직접 수정 | 핵심 변경 대상 |
| `lib/chat/chat-handler.ts` | 간접 영향 | `classifyIntent()` 호출부 (변경 불필요) |
| `app/api/chat/route.ts` | 간접 영향 | Intent 분류 결과 사용 (변경 불필요) |

### 하위 호환성

- `classifyByRules(message)` 형태로 호출해도 `persona`가 `undefined`로 전달됨
- 기존 OUT_OF_SCOPE 패턴 동작은 그대로 유지됨 (includedTopics가 없을 경우)
- 새로운 동작은 `persona.includedTopics`가 설정된 경우에만 활성화

---

## 다음 단계

Phase 2에서 다음 개선 사항을 검토합니다:

1. **단어 경계 매칭 개선**: `includes()` 대신 단어 경계를 고려한 매칭
   ```typescript
   // "포수"가 "포수대"에 매칭되지 않도록
   const wordBoundaryRegex = new RegExp(`\\b${topic}\\b`, 'i');
   ```

2. **LLM 분류 프롬프트 개선**: includedTopics/excludedTopics를 LLM 프롬프트에도 반영

3. **관리자 UI**: Console에서 includedTopics/excludedTopics 편집 기능

---

*작성일: 2026-01-19*
