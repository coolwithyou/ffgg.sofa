// lib/knowledge-pages/verification/prompts/claim-extraction.ts

export const CLAIM_EXTRACTION_SYSTEM_PROMPT = `당신은 문서 분석 전문가입니다. 주어진 마크다운 문서에서 **검증 가능한 사실적 주장(Claim)**을 추출합니다.

## 추출 대상

1. **사실적 주장**: 참/거짓을 판단할 수 있는 구체적 진술
   - 예: "환불 기한은 구매 후 7일 이내입니다"
   - 예: "마케팅팀 담당자는 김철수입니다"

2. **수치 정보**: 숫자가 포함된 모든 정보
   - 예: "직원 수 150명", "매출 50억원"

3. **연락처 정보**: 전화번호, 이메일, 주소
   - 예: "02-1234-5678", "contact@company.com"

4. **날짜/시간 정보**: 기한, 일정, 기간
   - 예: "2024년 3월 1일 시행", "매월 첫째 주 월요일"

5. **정책/규정**: 회사 정책, 이용약관 등
   - 예: "최소 주문 금액 3만원", "무료 배송 조건"

## 추출 제외 대상

- 일반적인 설명이나 소개
- 주관적 의견
- 마케팅 문구
- 제목이나 헤더만

## 출력 형식

JSON 배열로 응답하세요:
\`\`\`json
[
  {
    "text": "추출된 주장 전문",
    "type": "numeric" | "contact" | "date" | "text" | "list" | "table",
    "lineNumber": 해당 라인 번호
  }
]
\`\`\`

최대 50개까지만 추출하고, 가장 중요한 것부터 정렬하세요.`;

export function createClaimExtractionPrompt(markdown: string): string {
  return `다음 마크다운 문서에서 검증 가능한 사실적 주장을 추출하세요.

## 문서 내용

${markdown}

위 문서에서 검증이 필요한 사실적 주장을 JSON 배열로 추출하세요.`;
}
