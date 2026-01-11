# Phase 2: Claim 추출 및 검증 엔진

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | 재구성 문서에서 검증 가능한 주장 추출 및 자동 검증 |
| **산출물** | Claim 추출기 + Regex/LLM 검증기 + 위험도 계산기 |
| **의존성** | Phase 1 스키마 |
| **예상 기간** | 4일 |

---

## 수정 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `lib/knowledge-pages/verification/index.ts` | 신규 | 모듈 export |
| `lib/knowledge-pages/verification/claim-extractor.ts` | 신규 | Claim 추출 로직 |
| `lib/knowledge-pages/verification/regex-verifier.ts` | 신규 | 정규식 기반 검증 |
| `lib/knowledge-pages/verification/llm-verifier.ts` | 신규 | LLM 기반 검증 |
| `lib/knowledge-pages/verification/risk-calculator.ts` | 신규 | 위험도 계산 |
| `lib/knowledge-pages/verification/prompts/*.ts` | 신규 | LLM 프롬프트 |

---

## 폴더 구조

```
lib/knowledge-pages/verification/
├── index.ts                    # 모듈 export
├── claim-extractor.ts          # Claim 추출
├── regex-verifier.ts           # Regex 검증
├── llm-verifier.ts             # LLM 검증
├── risk-calculator.ts          # 위험도 계산
└── prompts/
    ├── claim-extraction.ts     # Claim 추출 프롬프트
    └── verification.ts         # 검증 프롬프트
```

---

## Claim 추출기

### claim-extractor.ts

```typescript
// lib/knowledge-pages/verification/claim-extractor.ts

import { db } from '@/lib/db';
import { claims, validationSessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { CLAIM_EXTRACTION_SYSTEM_PROMPT, createClaimExtractionPrompt } from './prompts/claim-extraction';

const anthropic = createAnthropic();

interface ExtractedClaim {
  text: string;
  type: 'numeric' | 'contact' | 'date' | 'text' | 'list' | 'table';
  location: {
    startLine: number;
    endLine: number;
    startChar: number;
    endChar: number;
  };
  riskLevel: 'high' | 'medium' | 'low';
}

/**
 * 재구성된 마크다운에서 검증 가능한 Claim 추출
 *
 * 추출 전략:
 * 1. 정규식으로 정형 데이터 (숫자, 연락처, 날짜) 추출
 * 2. LLM으로 텍스트 주장 추출
 * 3. 중복 제거 및 위험도 판정
 */
export async function extractClaims(
  sessionId: string,
  markdown: string
): Promise<ExtractedClaim[]> {
  // 1. 정규식 기반 추출 (정형 데이터)
  const regexClaims = extractRegexClaims(markdown);

  // 2. LLM 기반 추출 (텍스트 주장)
  const llmClaims = await extractLLMClaims(markdown);

  // 3. 중복 제거 및 병합
  const mergedClaims = deduplicateClaims([...regexClaims, ...llmClaims]);

  // 4. 위험도 판정
  const rankedClaims = assignRiskLevels(mergedClaims);

  // 5. DB 저장
  const savedClaims = await saveClaims(sessionId, rankedClaims);

  return savedClaims;
}

/**
 * 정규식 기반 Claim 추출
 *
 * 추출 대상:
 * - 숫자 (금액, 수량, 퍼센트)
 * - 연락처 (전화번호, 이메일)
 * - 날짜
 */
function extractRegexClaims(markdown: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const lines = markdown.split('\n');

  // 숫자 패턴 (금액, 수량, 퍼센트)
  const numericPatterns = [
    { regex: /(\d{1,3}(,\d{3})*)\s*(원|만원|억원)/g, type: 'numeric' as const },
    { regex: /(\d+)\s*(개|명|건|회|%)/g, type: 'numeric' as const },
    { regex: /(\d+\.?\d*)\s*%/g, type: 'numeric' as const },
  ];

  // 연락처 패턴
  const contactPatterns = [
    { regex: /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, type: 'contact' as const },
    { regex: /[\w.-]+@[\w.-]+\.\w+/g, type: 'contact' as const },
  ];

  // 날짜 패턴
  const datePatterns = [
    { regex: /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, type: 'date' as const },
    { regex: /\d{1,2}월\s*\d{1,2}일/g, type: 'date' as const },
    { regex: /\d{4}년\s*\d{1,2}월/g, type: 'date' as const },
  ];

  const allPatterns = [...numericPatterns, ...contactPatterns, ...datePatterns];

  let charOffset = 0;
  lines.forEach((line, lineIndex) => {
    for (const { regex, type } of allPatterns) {
      // Reset regex lastIndex for each line
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        claims.push({
          text: match[0],
          type,
          location: {
            startLine: lineIndex + 1,
            endLine: lineIndex + 1,
            startChar: charOffset + match.index,
            endChar: charOffset + match.index + match[0].length,
          },
          riskLevel: type === 'contact' ? 'high' : 'medium',
        });
      }
    }
    charOffset += line.length + 1; // +1 for newline
  });

  return claims;
}

/**
 * LLM 기반 Claim 추출
 *
 * 정규식으로 잡기 어려운 텍스트 기반 주장을 추출합니다.
 * 예: "환불 정책은 7일 이내입니다", "마케팅팀 담당자는 홍길동입니다"
 */
async function extractLLMClaims(markdown: string): Promise<ExtractedClaim[]> {
  // 문서가 너무 길면 청킹
  const maxChars = 30000;
  const truncatedMarkdown = markdown.length > maxChars
    ? markdown.slice(0, maxChars) + '\n\n[문서가 길어 일부만 분석합니다...]'
    : markdown;

  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-latest'),
    system: CLAIM_EXTRACTION_SYSTEM_PROMPT,
    prompt: createClaimExtractionPrompt(truncatedMarkdown),
    maxTokens: 4096,
    temperature: 0,
  });

  return parseClaimExtractionResult(text, markdown);
}

/**
 * LLM 응답 파싱
 */
function parseClaimExtractionResult(llmResponse: string, originalMarkdown: string): ExtractedClaim[] {
  try {
    // JSON 코드 블록 제거
    const cleanJson = llmResponse.replace(/```(?:json)?\\n?|\\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as Array<{
      text: string;
      type: string;
      lineNumber: number;
    }>;

    return parsed.map((item, index) => {
      // 원본에서 위치 찾기
      const location = findTextLocation(originalMarkdown, item.text, item.lineNumber);

      return {
        text: item.text,
        type: (item.type as ExtractedClaim['type']) || 'text',
        location,
        riskLevel: 'medium' as const,
      };
    });
  } catch (error) {
    console.error('Failed to parse LLM claims:', error);
    return [];
  }
}

/**
 * 텍스트 위치 찾기
 */
function findTextLocation(
  markdown: string,
  searchText: string,
  hintLineNumber?: number
): ExtractedClaim['location'] {
  const lines = markdown.split('\n');

  // 힌트 라인 주변 검색
  if (hintLineNumber && hintLineNumber > 0 && hintLineNumber <= lines.length) {
    const searchRange = 5; // 힌트 라인 ±5 범위
    const startLine = Math.max(0, hintLineNumber - searchRange - 1);
    const endLine = Math.min(lines.length, hintLineNumber + searchRange);

    for (let i = startLine; i < endLine; i++) {
      const charIndex = lines[i].indexOf(searchText);
      if (charIndex !== -1) {
        const startChar = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0) + charIndex;
        return {
          startLine: i + 1,
          endLine: i + 1,
          startChar,
          endChar: startChar + searchText.length,
        };
      }
    }
  }

  // 전체 검색
  const index = markdown.indexOf(searchText);
  if (index !== -1) {
    const beforeText = markdown.slice(0, index);
    const lineNumber = beforeText.split('\n').length;
    return {
      startLine: lineNumber,
      endLine: lineNumber,
      startChar: index,
      endChar: index + searchText.length,
    };
  }

  // 찾지 못한 경우 기본값
  return { startLine: 1, endLine: 1, startChar: 0, endChar: 0 };
}

/**
 * 중복 제거
 */
function deduplicateClaims(claims: ExtractedClaim[]): ExtractedClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.text}:${claim.location.startChar}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 위험도 할당
 */
function assignRiskLevels(claims: ExtractedClaim[]): ExtractedClaim[] {
  return claims.map((claim) => ({
    ...claim,
    riskLevel: determineRiskLevel(claim),
  }));
}

function determineRiskLevel(claim: ExtractedClaim): 'high' | 'medium' | 'low' {
  // 연락처는 무조건 High (오류 시 치명적)
  if (claim.type === 'contact') return 'high';

  // 숫자도 High (금액, 수량 오류 치명적)
  if (claim.type === 'numeric') return 'high';

  // 날짜는 Medium
  if (claim.type === 'date') return 'medium';

  // 테이블, 리스트는 Medium
  if (claim.type === 'table' || claim.type === 'list') return 'medium';

  // 일반 텍스트는 Low
  return 'low';
}

/**
 * DB 저장
 */
async function saveClaims(
  sessionId: string,
  extractedClaims: ExtractedClaim[]
): Promise<ExtractedClaim[]> {
  if (extractedClaims.length === 0) return [];

  const claimsToInsert = extractedClaims.map((claim, index) => ({
    sessionId,
    claimText: claim.text,
    claimType: claim.type,
    reconstructedLocation: claim.location,
    riskLevel: claim.riskLevel,
    sortOrder: index,
    verdict: 'pending' as const,
  }));

  await db.insert(claims).values(claimsToInsert);

  return extractedClaims;
}
```

### prompts/claim-extraction.ts

```typescript
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
```

---

## Regex 검증기

### regex-verifier.ts

```typescript
// lib/knowledge-pages/verification/regex-verifier.ts

import { db } from '@/lib/db';
import { claims, sourceSpans, validationSessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import Fuse from 'fuse.js';
import type { Claim } from '@/drizzle/schema';

interface MatchResult {
  found: boolean;
  matchedText: string;
  startChar: number;
  endChar: number;
  pageNumber?: number;
  score: number;
  method: 'exact' | 'fuzzy' | 'semantic';
}

/**
 * Regex 기반 검증 (Level 1)
 *
 * 정형 데이터(숫자, 연락처, 날짜)를 원문에서 직접 검색하여 검증합니다.
 *
 * 매칭 전략:
 * 1. Exact Match: 정확히 일치하는 값 검색
 * 2. Normalized Match: 공백/구두점 정규화 후 검색
 * 3. Fuzzy Match: Levenshtein 거리 기반 유사 검색
 */
export async function verifyWithRegex(
  sessionId: string,
  claimsToVerify: Claim[]
): Promise<void> {
  // 세션에서 원본 텍스트 조회
  const session = await db.query.validationSessions.findFirst({
    where: eq(validationSessions.id, sessionId),
  });
  if (!session) throw new Error('Session not found');

  const originalText = session.originalText;

  for (const claim of claimsToVerify) {
    const result = findSourceSpan(originalText, claim.claimText, claim.claimType);

    if (result.found) {
      // Claim 업데이트
      await db
        .update(claims)
        .set({
          verdict: 'supported',
          verificationLevel: 'regex',
          confidence: result.score,
          verificationDetail: result.method === 'exact'
            ? '원문에서 정확히 일치하는 값 발견'
            : `원문에서 유사한 값 발견 (유사도: ${Math.round(result.score * 100)}%)`,
        })
        .where(eq(claims.id, claim.id));

      // SourceSpan 저장
      await db.insert(sourceSpans).values({
        claimId: claim.id,
        sourceText: result.matchedText,
        startChar: result.startChar,
        endChar: result.endChar,
        pageNumber: result.pageNumber,
        matchScore: result.score,
        matchMethod: result.method,
      });
    }
    // 매칭 실패 시 verdict는 'pending' 유지 → LLM 검증으로 넘김
  }
}

/**
 * 원문에서 근거 스팬 찾기
 */
function findSourceSpan(
  originalText: string,
  claimText: string,
  claimType: string
): MatchResult {
  // 1. Exact Match
  const exactIndex = originalText.indexOf(claimText);
  if (exactIndex !== -1) {
    return {
      found: true,
      matchedText: claimText,
      startChar: exactIndex,
      endChar: exactIndex + claimText.length,
      score: 1.0,
      method: 'exact',
    };
  }

  // 2. Normalized Match (숫자의 경우)
  if (claimType === 'numeric') {
    const normalizedClaim = normalizeNumeric(claimText);
    const normalizedResult = findNormalizedMatch(originalText, normalizedClaim);

    if (normalizedResult) {
      return {
        found: true,
        ...normalizedResult,
        score: 0.95,
        method: 'fuzzy',
      };
    }
  }

  // 3. Normalized Match (연락처의 경우)
  if (claimType === 'contact') {
    const normalizedClaim = normalizeContact(claimText);
    const normalizedResult = findNormalizedContactMatch(originalText, normalizedClaim);

    if (normalizedResult) {
      return {
        found: true,
        ...normalizedResult,
        score: 0.95,
        method: 'fuzzy',
      };
    }
  }

  // 4. Fuzzy Match
  const fuzzyResult = findFuzzyMatch(originalText, claimText);
  if (fuzzyResult && fuzzyResult.score > 0.7) {
    return {
      found: true,
      matchedText: fuzzyResult.text,
      startChar: fuzzyResult.startChar,
      endChar: fuzzyResult.endChar,
      score: fuzzyResult.score,
      method: 'fuzzy',
    };
  }

  return { found: false, matchedText: '', startChar: 0, endChar: 0, score: 0, method: 'exact' };
}

/**
 * 숫자 정규화
 */
function normalizeNumeric(text: string): string {
  return text
    .replace(/[,.\s]/g, '')           // 쉼표, 점, 공백 제거
    .replace(/원|만원|억원/g, '')     // 단위 제거
    .replace(/개|명|건|회|%/g, '');   // 단위 제거
}

/**
 * 연락처 정규화
 */
function normalizeContact(text: string): string {
  // 전화번호의 경우 숫자만 추출
  if (/^\d/.test(text.replace(/[-.\s]/g, ''))) {
    return text.replace(/[-.\s]/g, '');
  }
  // 이메일은 소문자로
  return text.toLowerCase().trim();
}

/**
 * 정규화된 숫자 매칭
 */
function findNormalizedMatch(
  originalText: string,
  normalizedClaim: string
): { matchedText: string; startChar: number; endChar: number } | null {
  // 원본 텍스트에서 숫자 패턴 모두 찾기
  const numberPattern = /\d{1,3}(,\d{3})*(\.\d+)?\s*(원|만원|억원|개|명|건|회|%)?/g;
  let match;

  while ((match = numberPattern.exec(originalText)) !== null) {
    const normalizedMatch = normalizeNumeric(match[0]);
    if (normalizedMatch === normalizedClaim) {
      return {
        matchedText: match[0],
        startChar: match.index,
        endChar: match.index + match[0].length,
      };
    }
  }

  return null;
}

/**
 * 정규화된 연락처 매칭
 */
function findNormalizedContactMatch(
  originalText: string,
  normalizedClaim: string
): { matchedText: string; startChar: number; endChar: number } | null {
  // 전화번호 패턴
  const phonePattern = /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
  // 이메일 패턴
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/gi;

  const patterns = [phonePattern, emailPattern];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(originalText)) !== null) {
      const normalizedMatch = normalizeContact(match[0]);
      if (normalizedMatch === normalizedClaim) {
        return {
          matchedText: match[0],
          startChar: match.index,
          endChar: match.index + match[0].length,
        };
      }
    }
  }

  return null;
}

/**
 * Fuzzy 매칭 (Fuse.js 사용)
 */
function findFuzzyMatch(
  originalText: string,
  searchText: string
): { text: string; startChar: number; endChar: number; score: number } | null {
  // 텍스트를 청크로 분할
  const chunks = splitIntoChunks(originalText, searchText.length * 2);

  const fuse = new Fuse(chunks.map((c) => c.text), {
    includeScore: true,
    threshold: 0.4,
    distance: 100,
  });

  const results = fuse.search(searchText);

  if (results.length > 0 && results[0].score !== undefined) {
    const bestMatch = results[0];
    const matchedChunk = chunks[bestMatch.refIndex];

    return {
      text: matchedChunk.text,
      startChar: matchedChunk.startChar,
      endChar: matchedChunk.endChar,
      score: 1 - bestMatch.score, // Fuse.js score는 낮을수록 좋음
    };
  }

  return null;
}

/**
 * 텍스트를 오버랩 청크로 분할
 */
function splitIntoChunks(
  text: string,
  chunkSize: number
): { text: string; startChar: number; endChar: number }[] {
  const chunks: { text: string; startChar: number; endChar: number }[] = [];
  const step = Math.max(Math.floor(chunkSize / 2), 10);

  for (let i = 0; i < text.length; i += step) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push({
      text: text.slice(i, end),
      startChar: i,
      endChar: end,
    });
  }

  return chunks;
}
```

---

## LLM 검증기

### llm-verifier.ts

```typescript
// lib/knowledge-pages/verification/llm-verifier.ts

import { db } from '@/lib/db';
import { claims, sourceSpans, validationSessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { VERIFICATION_SYSTEM_PROMPT, createVerificationPrompt } from './prompts/verification';
import type { Claim } from '@/drizzle/schema';

const anthropic = createAnthropic();

interface VerificationResult {
  claimId: string;
  verdict: 'supported' | 'contradicted' | 'not_found';
  confidence: number;
  suspicionType?: 'added' | 'missing' | 'moved' | 'contradicted';
  sourceSpan?: {
    text: string;
    startChar: number;
    endChar: number;
  };
  explanation: string;
}

/**
 * LLM 기반 검증 (Level 2)
 *
 * Regex로 검증되지 않은 Claim을 LLM으로 검증합니다.
 * 원문과 Claim을 비교하여 SUPPORTED/CONTRADICTED/NOT_FOUND 판정.
 */
export async function verifyWithLLM(
  sessionId: string,
  claimsToVerify: Claim[]
): Promise<void> {
  if (claimsToVerify.length === 0) return;

  const session = await db.query.validationSessions.findFirst({
    where: eq(validationSessions.id, sessionId),
  });
  if (!session) throw new Error('Session not found');

  // LLM 호출
  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-latest'),
    system: VERIFICATION_SYSTEM_PROMPT,
    prompt: createVerificationPrompt(
      session.originalText,
      claimsToVerify.map((c) => ({ id: c.id, text: c.claimText }))
    ),
    maxTokens: 4096,
    temperature: 0,
  });

  // 결과 파싱
  const results = parseVerificationResults(text, claimsToVerify);

  // DB 업데이트
  for (const result of results) {
    await db
      .update(claims)
      .set({
        verdict: result.verdict,
        verificationLevel: 'llm',
        confidence: result.confidence,
        verificationDetail: result.explanation,
        suspicionType: result.suspicionType,
      })
      .where(eq(claims.id, result.claimId));

    if (result.sourceSpan) {
      // 실제 위치 찾기
      const actualStart = session.originalText.indexOf(result.sourceSpan.text);
      const actualEnd = actualStart !== -1
        ? actualStart + result.sourceSpan.text.length
        : result.sourceSpan.endChar;

      await db.insert(sourceSpans).values({
        claimId: result.claimId,
        sourceText: result.sourceSpan.text,
        startChar: actualStart !== -1 ? actualStart : result.sourceSpan.startChar,
        endChar: actualEnd,
        matchScore: result.confidence,
        matchMethod: 'semantic',
      });
    }
  }
}

/**
 * LLM 응답 파싱
 */
function parseVerificationResults(
  llmResponse: string,
  originalClaims: Claim[]
): VerificationResult[] {
  try {
    // JSON 코드 블록 제거
    const cleanJson = llmResponse.replace(/```(?:json)?\\n?|\\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as Array<{
      claimId: string;
      verdict: string;
      confidence: number;
      suspicionType?: string;
      sourceSpan?: { text: string; startChar: number; endChar: number };
      explanation: string;
    }>;

    return parsed.map((item) => ({
      claimId: item.claimId,
      verdict: item.verdict.toLowerCase() as VerificationResult['verdict'],
      confidence: item.confidence,
      suspicionType: item.suspicionType?.toLowerCase() as VerificationResult['suspicionType'],
      sourceSpan: item.sourceSpan,
      explanation: item.explanation,
    }));
  } catch (error) {
    console.error('Failed to parse LLM verification results:', error);

    // 파싱 실패 시 모든 Claim을 NOT_FOUND로 처리
    return originalClaims.map((claim) => ({
      claimId: claim.id,
      verdict: 'not_found' as const,
      confidence: 0.5,
      explanation: 'LLM 검증 결과 파싱 실패',
    }));
  }
}
```

### prompts/verification.ts

```typescript
// lib/knowledge-pages/verification/prompts/verification.ts

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
  // 원본이 너무 길면 자르기
  const maxLength = 50000;
  const truncatedOriginal = originalText.length > maxLength
    ? originalText.slice(0, maxLength) + '\n\n[문서가 길어 일부만 표시됨...]'
    : originalText;

  return `## 원본 문서

${truncatedOriginal}

---

## 검증할 Claim 목록

${claims.map((c, i) => `${i + 1}. [ID: ${c.id}]\n   "${c.text}"`).join('\n\n')}

---

위 ${claims.length}개의 Claim을 원본 문서와 비교하여 검증 결과를 JSON 배열로 응답하세요.`;
}
```

---

## 위험도 계산기

### risk-calculator.ts

```typescript
// lib/knowledge-pages/verification/risk-calculator.ts

import { db } from '@/lib/db';
import { claims, validationSessions } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * 검증 세션의 전체 위험도 점수 계산
 *
 * 점수 계산 공식:
 * score = (contradicted * 3 + notFound * 2 + highRisk * 1.5) / (totalClaims * 3)
 *
 * 범위: 0.0 (안전) ~ 1.0 (위험)
 */
export async function calculateRiskScore(sessionId: string): Promise<number> {
  const allClaims = await db.query.claims.findMany({
    where: eq(claims.sessionId, sessionId),
  });

  if (allClaims.length === 0) {
    await db
      .update(validationSessions)
      .set({ riskScore: 0 })
      .where(eq(validationSessions.id, sessionId));
    return 0;
  }

  const contradictedCount = allClaims.filter((c) => c.verdict === 'contradicted').length;
  const notFoundCount = allClaims.filter((c) => c.verdict === 'not_found').length;
  const highRiskCount = allClaims.filter((c) => c.riskLevel === 'high').length;

  // 가중치 적용 점수 계산
  const weightedScore =
    (contradictedCount * 3 + notFoundCount * 2 + highRiskCount * 1.5) /
    (allClaims.length * 3);

  const riskScore = Math.min(1, Math.max(0, weightedScore));

  // CONTRADICTED인 Claim은 자동으로 High Risk로 승격
  await db
    .update(claims)
    .set({ riskLevel: 'high' })
    .where(
      and(
        eq(claims.sessionId, sessionId),
        eq(claims.verdict, 'contradicted')
      )
    );

  // 세션 위험도 점수 업데이트
  const updatedHighRiskCount = allClaims.filter(
    (c) => c.verdict === 'contradicted' || c.riskLevel === 'high'
  ).length;

  await db
    .update(validationSessions)
    .set({
      riskScore,
      highRiskCount: updatedHighRiskCount,
    })
    .where(eq(validationSessions.id, sessionId));

  return riskScore;
}

/**
 * 개별 Claim의 위험도 레벨 결정
 */
export function assignRiskLevel(claim: {
  claimType: string;
  verdict?: string;
}): 'high' | 'medium' | 'low' {
  // CONTRADICTED는 무조건 High
  if (claim.verdict === 'contradicted') return 'high';

  // 타입별 기본 위험도
  const typeRiskMap: Record<string, 'high' | 'medium' | 'low'> = {
    contact: 'high',   // 연락처 오류는 치명적
    numeric: 'high',   // 숫자 오류도 치명적
    date: 'medium',    // 날짜는 중간
    table: 'medium',   // 테이블 구조
    list: 'low',       // 목록
    text: 'low',       // 일반 텍스트
  };

  return typeRiskMap[claim.claimType] || 'low';
}
```

---

## 모듈 Export

### index.ts

```typescript
// lib/knowledge-pages/verification/index.ts

export { extractClaims } from './claim-extractor';
export { verifyWithRegex } from './regex-verifier';
export { verifyWithLLM } from './llm-verifier';
export { calculateRiskScore, assignRiskLevel } from './risk-calculator';
```

---

## 패키지 설치

```bash
# Fuse.js (Fuzzy 매칭)
pnpm add fuse.js
pnpm add -D @types/fuse.js
```

---

## 체크리스트

- [ ] `lib/knowledge-pages/verification/` 디렉토리 생성
- [ ] `claim-extractor.ts` 구현
  - [ ] 정규식 Claim 추출
  - [ ] LLM Claim 추출
  - [ ] 중복 제거 및 병합
  - [ ] DB 저장
- [ ] `regex-verifier.ts` 구현
  - [ ] Exact Match
  - [ ] Normalized Match
  - [ ] Fuzzy Match (Fuse.js)
- [ ] `llm-verifier.ts` 구현
  - [ ] 배치 처리
  - [ ] 결과 파싱
  - [ ] SourceSpan 저장
- [ ] `risk-calculator.ts` 구현
- [ ] `prompts/` 디렉토리에 프롬프트 분리
- [ ] Fuse.js 패키지 설치
- [ ] TypeScript 컴파일 확인

---

## 테스트 방법

### 단위 테스트

```typescript
// __tests__/verification/claim-extractor.test.ts

import { extractRegexClaims } from '@/lib/knowledge-pages/verification/claim-extractor';

describe('Claim Extractor', () => {
  describe('extractRegexClaims', () => {
    it('숫자 패턴 추출', () => {
      const markdown = '직원 수는 150명이고 매출은 50억원입니다.';
      const claims = extractRegexClaims(markdown);

      expect(claims).toHaveLength(2);
      expect(claims[0].text).toBe('150명');
      expect(claims[0].type).toBe('numeric');
      expect(claims[1].text).toBe('50억원');
    });

    it('연락처 패턴 추출', () => {
      const markdown = '문의: 02-1234-5678, contact@company.com';
      const claims = extractRegexClaims(markdown);

      expect(claims).toHaveLength(2);
      expect(claims[0].type).toBe('contact');
      expect(claims[1].type).toBe('contact');
    });

    it('날짜 패턴 추출', () => {
      const markdown = '시행일: 2024-03-01, 마감: 3월 15일';
      const claims = extractRegexClaims(markdown);

      expect(claims).toHaveLength(2);
      expect(claims[0].type).toBe('date');
      expect(claims[1].type).toBe('date');
    });
  });
});
```

### 통합 테스트

```bash
# Inngest Dev Server에서 파이프라인 테스트
npx inngest-cli dev

# 문서 업로드 후 검증 파이프라인 실행 확인
# http://localhost:8288
```

---

## 다음 단계

[Phase 3: Dual Viewer UI](./phase-3-dual-viewer-ui.md)에서 검증 UI를 구현합니다.

---

*작성일: 2026-01-11*
