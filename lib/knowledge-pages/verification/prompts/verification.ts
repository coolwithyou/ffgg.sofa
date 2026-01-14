// lib/knowledge-pages/verification/prompts/verification.ts

import {
  truncateWithWarning,
  TRUNCATION_LIMITS,
} from '../../utils/truncation';

export const VERIFICATION_SYSTEM_PROMPT = `당신은 문서 검증 전문가입니다. 재구성된 문서의 주장(Claim)이 원본 문서에 근거가 있는지 검증합니다.

## 판정 기준

### 1. SUPPORTED (지지됨)
원본에 명확한 근거가 있음:
- 정확히 일치하거나 의미적으로 동등한 내용이 원본에 존재
- 근거 위치(텍스트 스니펫)를 반드시 제시

### 2. CONTRADICTED (모순됨)
원본과 모순됨:
- 원본에 다른 값/내용이 명시되어 있음
- 예: Claim "연락처 30개" vs 원본 "연락처 25개"

### 3. NOT_FOUND (근거 없음)
근거를 찾을 수 없음:
- 원본에 해당 내용이 없거나 애매함
- 환각(Hallucination) 가능성 있음

## 의심 유형 분류

- **ADDED**: 원본에 없는 정보가 추가됨
- **MISSING**: 원본에 있는 중요 정보가 누락됨 (이 경우 NOT_FOUND)
- **MOVED**: 원본의 맥락과 다른 위치에 배치됨
- **CONTRADICTED**: 원본과 직접 모순됨

## 출력 형식

JSON 배열로 응답하세요. 각 Claim에 대해:

\`\`\`json
[
  {
    "claimId": "UUID",
    "verdict": "SUPPORTED" | "CONTRADICTED" | "NOT_FOUND",
    "confidence": 0.0-1.0,
    "suspicionType": "ADDED" | "MISSING" | "MOVED" | "CONTRADICTED" | null,
    "sourceSpan": {
      "text": "원본에서 찾은 근거 텍스트 (최대 200자)",
      "startChar": 시작위치,
      "endChar": 끝위치
    } | null,
    "explanation": "판정 이유 (한 문장)"
  }
]
\`\`\`

## 주의사항

1. 숫자가 다르면 반드시 CONTRADICTED
2. 근거를 찾았으면 sourceSpan 필수 제공
3. 애매한 경우 NOT_FOUND + confidence 낮게
4. 원본 텍스트 범위 내에서만 검색`;

export function createVerificationPrompt(
  originalText: string,
  claims: Array<{ id: string; text: string }>
): string {
  // 원본이 너무 길면 자르기 (검증은 Claude Haiku 사용 - 더 작은 컨텍스트)
  const truncation = truncateWithWarning(originalText, {
    maxChars: TRUNCATION_LIMITS.CLAIM_VERIFICATION,
    context: 'verification/prompt',
    truncationMessage: '\n\n[문서가 길어 일부만 표시됨...]',
  });

  return `## 원본 문서

${truncation.text}

---

## 검증할 Claim 목록

${claims.map((c, i) => `${i + 1}. [ID: ${c.id}]\n   "${c.text}"`).join('\n\n')}

---

위 ${claims.length}개의 Claim을 원본 문서와 비교하여 검증 결과를 JSON 배열로 응답하세요.`;
}
