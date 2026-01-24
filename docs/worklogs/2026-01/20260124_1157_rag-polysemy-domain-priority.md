# RAG 동음이의어(Polysemy) 문제 해결 - 도메인 우선 분류 구현

**일시**: 2026-01-24 11:57
**키워드**: RAG, Polysemy, Intent Classification, Query Rewriting, Domain Context

## 요청 사항
RAG 시스템에서 도메인 전문 용어(예: "포수" = 옻칠 마감 기법)가 일반적 의미(야구 포수)로 오인식되어 OUT_OF_SCOPE로 잘못 분류되는 문제 해결. 계획서(`~/.claude/plans/cheerful-doodling-rossum.md`)에 따라 Phase 1→4→2→3 순서로 구현.

## 수정 내용

- `lib/chat/intent-classifier.ts` - Phase 1: includedTopics 우선 체크 로직, Phase 4: domainGlossary 필드 추가
- `lib/chat/service.ts` - 도메인 컨텍스트 생성 및 검색 함수에 전달, 미사용 import 정리
- `lib/rag/query-rewriter.ts` - Phase 2: 도메인 인지 쿼리 재작성 프롬프트 구현
- `lib/rag/retrieval.ts` - Phase 3: DomainContext 인터페이스, injectDomainContext() 함수 추가

## 주요 결정
| 결정 | 이유 |
|------|------|
| includedTopics를 OUT_OF_SCOPE 패턴보다 먼저 체크 | 도메인 키워드가 일반 패턴에 잘못 매칭되는 것 방지 |
| 검색 쿼리에 `[expertiseArea]` 프리픽스 주입 | 임베딩 생성 시 도메인 컨텍스트가 반영되어 유사도 향상 |
| 모든 도메인 정보를 optional 처리 | 기존 챗봇에 영향 없는 Graceful Degradation |
| Phase 순서: 1→4→2→3 | 의존성 순서 (4는 타입 정의, 2는 4 의존, 3은 독립적) |

## 시행착오
- Serena `find_symbol` 도구 파라미터명: `name_path`가 아닌 `name_path_pattern` 사용 필요
- 반면 `insert_after_symbol`은 `name_path` 사용 (도구별 파라미터명 상이)

## 검증 결과
- TypeScript 타입 체크 통과
- ESLint 검사 통과
- retrieval 테스트 36개 전체 통과

## 참고
- 계획서: `~/.claude/plans/cheerful-doodling-rossum.md`
- 테스트 페르소나 예시:
```typescript
const ottchilPersona: PersonaConfig = {
  name: '옻칠 전문가',
  expertiseArea: '옻칠 기법 안내',
  includedTopics: ['옻칠', '포수', '생칠', '건칠'],
  excludedTopics: ['야구', '스포츠'],
  domainGlossary: { '포수': '布水, 옻칠 마감 기법' },
};
```