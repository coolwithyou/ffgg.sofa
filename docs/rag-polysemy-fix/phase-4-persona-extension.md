# Phase 4: PersonaConfig 확장

## 개요

**목표**: `PersonaConfig`에 `domainGlossary` (도메인 용어 사전) 필드를 추가하여 동음이의어 해소 지원

**문제점**:
- 현재 `PersonaConfig`에는 도메인 용어 사전 필드가 없음
- 동음이의어에 대한 명시적 정의를 저장할 곳이 없음
- Phase 2의 Domain-Aware Query Rewriting에 용어 사전이 필요

**해결 방안**:
1. `PersonaConfig`에 `domainGlossary` 필드 추가
2. `DEFAULT_PERSONA`에 빈 객체 기본값 설정
3. 타입 정의 문서화

**예상 시간**: 30분
**비용**: 0 (타입 변경만)

---

## 수정 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `lib/chat/intent-classifier.ts` | 수정 | `PersonaConfig` 인터페이스에 `domainGlossary` 필드 추가 |

---

## 코드 변경 상세

### 1. PersonaConfig 인터페이스 확장

**현재 코드** (`lib/chat/intent-classifier.ts`):

```typescript
export interface PersonaConfig {
  name: string;
  /** 전문 분야 요약 (짧은 설명) */
  expertiseArea: string;
  /** 전문 분야 상세 설명 (RAG 접근 판단에 사용) */
  expertiseDescription?: string;
  /** 포함되는 주제 목록 (이 주제들은 RAG 검색 대상) */
  includedTopics?: string[];
  /** 제외되는 주제 목록 (이 주제들은 OUT_OF_SCOPE로 분류) */
  excludedTopics?: string[];
  tone: 'professional' | 'friendly' | 'casual';
}

export const DEFAULT_PERSONA: PersonaConfig = {
  name: 'AI 어시스턴트',
  expertiseArea: '기업 문서 및 FAQ',
  expertiseDescription: '',
  includedTopics: [],
  excludedTopics: [],
  tone: 'friendly',
};
```

**변경 후 코드**:

```typescript
export interface PersonaConfig {
  name: string;
  /** 전문 분야 요약 (짧은 설명) */
  expertiseArea: string;
  /** 전문 분야 상세 설명 (RAG 접근 판단에 사용) */
  expertiseDescription?: string;
  /** 포함되는 주제 목록 (이 주제들은 RAG 검색 대상) */
  includedTopics?: string[];
  /** 제외되는 주제 목록 (이 주제들은 OUT_OF_SCOPE로 분류) */
  excludedTopics?: string[];
  tone: 'professional' | 'friendly' | 'casual';

  /**
   * 도메인 용어 사전 (동음이의어 해소용)
   *
   * 키: 동음이의어/도메인 용어
   * 값: 해당 도메인에서의 정의
   *
   * @example
   * {
   *   "포수": "布水, 옻칠 마감 기법으로 물을 뿌려 광택을 내는 과정",
   *   "생칠": "生漆, 옻나무에서 채취한 천연 옻",
   *   "건칠": "乾漆, 옻을 바른 후 건조시킨 상태"
   * }
   */
  domainGlossary?: Record<string, string>;
}

export const DEFAULT_PERSONA: PersonaConfig = {
  name: 'AI 어시스턴트',
  expertiseArea: '기업 문서 및 FAQ',
  expertiseDescription: '',
  includedTopics: [],
  excludedTopics: [],
  tone: 'friendly',
  domainGlossary: {},
};
```

---

## 사용 예시

### 옻칠 전문 챗봇

```typescript
const ottchilPersona: PersonaConfig = {
  name: '옻칠 전문가',
  expertiseArea: '옻칠 기법 안내',
  expertiseDescription: '전통 옻칠 기법, 재료, 도구, 작업 과정에 대한 전문 지식을 제공합니다.',
  includedTopics: ['옻칠', '포수', '생칠', '건칠', '주칠', '흑칠', '삼베', '베짜기'],
  excludedTopics: ['야구', '스포츠', '프로그래밍', '주식'],
  tone: 'friendly',
  domainGlossary: {
    '포수': '布水, 옻칠 마감 기법으로 물을 뿌려 광택을 내는 과정',
    '생칠': '生漆, 옻나무에서 채취한 천연 옻. 정제하지 않은 상태',
    '건칠': '乾漆, 옻을 바른 후 건조시킨 상태',
    '주칠': '朱漆, 붉은색 옻칠. 주사(朱砂)를 섞어 만듦',
    '흑칠': '黑漆, 검은색 옻칠. 철분을 섞어 만듦',
  },
};
```

### 의료 전문 챗봇

```typescript
const medicalPersona: PersonaConfig = {
  name: '건강 상담사',
  expertiseArea: '건강 정보 안내',
  expertiseDescription: '일반적인 건강 정보와 생활 습관에 대한 조언을 제공합니다. 진단이나 처방은 하지 않습니다.',
  includedTopics: ['건강', '영양', '운동', '식이요법'],
  excludedTopics: ['진단', '처방', '약물'],
  tone: 'professional',
  domainGlossary: {
    '수술': '외과적 치료 방법 (진단/처방 제외)',
    '혈압': '심장이 혈액을 내보낼 때 혈관에 가해지는 압력',
    '콜레스테롤': '혈액 내 지방의 일종으로 HDL(좋은)과 LDL(나쁜)로 구분',
  },
};
```

### 법률 전문 챗봇

```typescript
const legalPersona: PersonaConfig = {
  name: '법률 상담 도우미',
  expertiseArea: '법률 정보 안내',
  expertiseDescription: '일반적인 법률 정보와 절차를 안내합니다. 법적 조언은 아닙니다.',
  includedTopics: ['계약', '소송', '형사', '민사', '노동법'],
  excludedTopics: ['변호', '대리'],
  tone: 'professional',
  domainGlossary: {
    '소장': '訴狀, 법원에 소송을 제기할 때 제출하는 서면',
    '항소': '抗訴, 제1심 판결에 불복하여 상급법원에 재심을 청구하는 것',
    '기각': '棄却, 청구를 받아들이지 않는 재판부의 결정',
  },
};
```

---

## domainGlossary 활용처

| Phase | 활용 방식 | 설명 |
|-------|----------|------|
| Phase 2 | Query Rewriting 프롬프트 | 쿼리 재작성 시 용어 정의를 LLM에 전달하여 도메인 맥락 이해 |
| Phase 3 | 검색 쿼리 보강 | 검색 쿼리에 용어 정의를 추가하여 임베딩 품질 향상 |
| 응답 생성 | 시스템 프롬프트 | 응답 생성 시 정확한 용어 사용 유도 |

### Phase 2 활용 예시

```typescript
// lib/rag/query-rewriter.ts
function buildDomainAwarePrompt(persona: PersonaConfig): string {
  let glossarySection = '';

  if (persona.domainGlossary && Object.keys(persona.domainGlossary).length > 0) {
    glossarySection = `
## 도메인 용어 사전
${Object.entries(persona.domainGlossary)
  .map(([term, definition]) => `- **${term}**: ${definition}`)
  .join('\n')}

쿼리에 위 용어가 포함된 경우, 일반적 의미가 아닌 위 정의를 기준으로 해석하세요.
`;
  }

  return `당신은 ${persona.expertiseArea} 전문 쿼리 재작성 도우미입니다.
${glossarySection}
...`;
}
```

---

## 체크리스트

### 구현 체크리스트

- [ ] `PersonaConfig` 인터페이스에 `domainGlossary` 필드 추가
- [ ] `DEFAULT_PERSONA`에 `domainGlossary: {}` 기본값 추가
- [ ] JSDoc 주석 및 `@example` 추가
- [ ] 타입 체크 통과 (`pnpm tsc --noEmit`)

### 테스트 체크리스트

- [ ] 기존 `PersonaConfig` 사용 코드가 타입 에러 없이 동작
- [ ] `domainGlossary` 미설정 시 `undefined` 또는 `{}` 반환 확인
- [ ] Phase 2 연동 시 용어 사전이 프롬프트에 포함되는지 확인

### 배포 체크리스트

- [ ] 기존 페르소나 설정 데이터 마이그레이션 불필요 확인
- [ ] 콘솔 UI 업데이트 이슈 생성 (향후 작업)

---

## 데이터 마이그레이션

### DB 스키마 영향도

`chatbots` 테이블의 `persona_config` 컬럼은 **JSONB** 타입으로 유연한 구조입니다.

```sql
-- 현재 스키마 (변경 불필요)
persona_config JSONB DEFAULT '{}'::jsonb
```

### 기존 데이터 호환성

| 케이스 | 동작 | 결과 |
|--------|------|------|
| `domainGlossary` 미설정 | `undefined` 반환 | Phase 2 코드에서 빈 사전으로 처리 |
| 기존 페르소나 데이터 | 그대로 유지 | 새 필드 없어도 동작 |
| 새 페르소나 생성 | `domainGlossary` 선택적 입력 | 입력 시 저장, 미입력 시 생략 |

### 마이그레이션 스크립트 (필요 없음)

`domainGlossary`는 **optional** 필드이므로:
- DB 마이그레이션 불필요
- 기존 데이터 업데이트 불필요
- 런타임에서 `undefined` 처리로 충분

```typescript
// 안전한 접근 패턴
const glossary = persona.domainGlossary ?? {};
const hasGlossary = Object.keys(glossary).length > 0;
```

---

## 콘솔 UI 업데이트 (향후)

Phase 4 완료 후, 콘솔 UI에서 `domainGlossary` 편집 기능 추가가 필요합니다.

### 제안 UI 위치

```
설정 → 페르소나 → 도메인 용어 사전
```

### 제안 UI 형태

```tsx
// 키-값 편집 UI 예시
<Card>
  <CardHeader>
    <CardTitle>도메인 용어 사전</CardTitle>
    <CardDescription>
      동음이의어나 전문 용어를 정의하여 챗봇이 정확하게 이해할 수 있도록 합니다.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {Object.entries(glossary).map(([term, definition], index) => (
      <div key={index} className="flex gap-2">
        <Input placeholder="용어" value={term} />
        <Input placeholder="정의" value={definition} className="flex-1" />
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ))}
    <Button variant="outline" onClick={addTerm}>
      <Plus className="mr-2 h-4 w-4" />
      용어 추가
    </Button>
  </CardContent>
</Card>
```

### 관련 이슈 (생성 권장)

- 이슈 제목: `feat(console): 페르소나 도메인 용어 사전 편집 UI 추가`
- 의존성: Phase 4 완료 후
- 우선순위: 낮음 (API 먼저 완료)

---

## 변경 영향 범위

### 직접 영향

| 파일 | 영향 | 설명 |
|------|------|------|
| `lib/chat/intent-classifier.ts` | 수정 필요 | 타입 확장 |
| `lib/chat/service.ts` | 영향 없음 | `PersonaConfig` 그대로 사용 |
| `lib/rag/query-rewriter.ts` | Phase 2에서 활용 | 프롬프트에 용어 사전 포함 |

### 간접 영향

| 영역 | 영향 | 설명 |
|------|------|------|
| API 엔드포인트 | 영향 없음 | JSONB 유연 구조 |
| 프론트엔드 | 향후 UI 추가 필요 | 용어 사전 편집 UI |
| 테스트 | 추가 케이스 필요 | 용어 사전 활용 테스트 |

---

## 관련 문서

- [README.md](./README.md) - 전체 개요
- [Phase 1: Domain-First Classification](./phase-1-domain-first-classification.md)
- [Phase 2: Domain-Aware Query Rewriting](./phase-2-domain-aware-rewriting.md)
- [Phase 3: Search Context Injection](./phase-3-search-context-injection.md)

---

*문서 작성일: 2026-01-19*
*상태: 구현 대기*
*예상 소요 시간: 30분*
*의존성: 없음 (독립 구현 가능)*
*후속 작업: Phase 2에서 활용*
