/**
 * 문서 구조 분석 LLM 프롬프트
 *
 * 문서를 계층적인 Knowledge Pages 구조로 분해하기 위한 프롬프트입니다.
 * Claude Haiku 모델에 최적화되어 있습니다.
 */

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
- 고유해야 함 (중복 금지)

## 출력 형식
JSON만 출력하세요. 설명이나 마크다운 코드 블록 없이 순수 JSON만 반환합니다.`;

/**
 * 구조 분석 사용자 프롬프트 생성
 */
export function createStructureAnalysisPrompt(documentText: string): string {
  return `아래 문서를 분석하여 페이지 트리 구조를 JSON으로 출력하세요.

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
}

## 규칙
1. sourcePages는 원본 문서에서 해당 내용이 있는 페이지 번호입니다
2. 페이지 번호를 알 수 없으면 [0]으로 설정
3. contentSummary는 한 문장으로 간결하게
4. 깊이는 최대 3단계까지만 (루트 → 1단계 → 2단계)`;
}
