/**
 * 페이지 콘텐츠 생성 LLM 프롬프트
 *
 * 구조 분석 결과를 바탕으로 각 페이지의 마크다운 콘텐츠를 생성합니다.
 * Claude Haiku 모델에 최적화되어 있습니다.
 */

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
- 중요 내용은 **굵게** 또는 > 인용구 사용

## 분량
- 200~800 단어가 적절합니다
- 원문이 짧으면 불필요하게 늘리지 마세요
- 원문이 길면 핵심만 간추리세요 (하위 페이지에서 상세 다룰 수 있음)`;

/**
 * 콘텐츠 생성 사용자 프롬프트 생성
 */
export function createContentGenerationPrompt(
  title: string,
  breadcrumb: string,
  contentSummary: string,
  sourceText: string,
  sourcePages: number[]
): string {
  return `## 페이지 정보
- 제목: ${title}
- 상위 경로: ${breadcrumb || '(루트)'}
- 이 페이지의 역할: ${contentSummary}
- 원본 위치: ${sourcePages.length > 0 ? `${sourcePages.join(', ')}페이지` : '전체 문서'}

## 원문

${sourceText}

## 지시사항
위 원문을 기반으로 "${title}" 페이지의 마크다운 콘텐츠를 작성하세요.
마크다운 콘텐츠만 출력하고, 설명이나 코드 블록 표시 없이 내용만 반환합니다.

## 주의사항
- 원문의 숫자, 날짜, 연락처, URL은 정확히 유지
- 원문에 없는 정보는 추가하지 않음
- 원문의 전문 용어나 고유명사는 그대로 사용`;
}
