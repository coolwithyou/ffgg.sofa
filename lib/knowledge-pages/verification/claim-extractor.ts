// lib/knowledge-pages/verification/claim-extractor.ts

import { db } from '@/lib/db';
import { claims } from '@/drizzle/schema';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import {
  CLAIM_EXTRACTION_SYSTEM_PROMPT,
  createClaimExtractionPrompt,
} from './prompts/claim-extraction';
import type { ClaimType, RiskLevel, ReconstructedLocation } from '../types';

interface ExtractedClaim {
  text: string;
  type: ClaimType;
  location: ReconstructedLocation;
  riskLevel: RiskLevel;
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
export function extractRegexClaims(markdown: string): ExtractedClaim[] {
  const extractedClaims: ExtractedClaim[] = [];
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
        extractedClaims.push({
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

  return extractedClaims;
}

/**
 * LLM 기반 Claim 추출
 *
 * 정규식으로 잡기 어려운 텍스트 기반 주장을 추출합니다.
 * 예: "환불 정책은 7일 이내입니다", "마케팅팀 담당자는 홍길동입니다"
 */
async function extractLLMClaims(markdown: string): Promise<ExtractedClaim[]> {
  // Gemini 2.0 Flash는 큰 컨텍스트 지원
  const maxChars = 100000;
  const truncatedMarkdown =
    markdown.length > maxChars
      ? markdown.slice(0, maxChars) + '\n\n[문서가 길어 일부만 분석합니다...]'
      : markdown;

  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    system: CLAIM_EXTRACTION_SYSTEM_PROMPT,
    prompt: createClaimExtractionPrompt(truncatedMarkdown),
    maxOutputTokens: 8192,
    temperature: 0,
  });

  return parseClaimExtractionResult(text, markdown);
}

/**
 * LLM 응답 파싱
 */
function parseClaimExtractionResult(
  llmResponse: string,
  originalMarkdown: string
): ExtractedClaim[] {
  try {
    // JSON 코드 블록 제거
    const cleanJson = llmResponse.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as Array<{
      text: string;
      type: string;
      lineNumber: number;
    }>;

    return parsed.map((item) => {
      // 원본에서 위치 찾기
      const location = findTextLocation(
        originalMarkdown,
        item.text,
        item.lineNumber
      );

      return {
        text: item.text,
        type: (item.type as ClaimType) || 'text',
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
): ReconstructedLocation {
  const lines = markdown.split('\n');

  // 힌트 라인 주변 검색
  if (hintLineNumber && hintLineNumber > 0 && hintLineNumber <= lines.length) {
    const searchRange = 5; // 힌트 라인 ±5 범위
    const startLine = Math.max(0, hintLineNumber - searchRange - 1);
    const endLine = Math.min(lines.length, hintLineNumber + searchRange);

    for (let i = startLine; i < endLine; i++) {
      const charIndex = lines[i].indexOf(searchText);
      if (charIndex !== -1) {
        const startChar =
          lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0) + charIndex;
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
function deduplicateClaims(claimsList: ExtractedClaim[]): ExtractedClaim[] {
  const seen = new Set<string>();
  return claimsList.filter((claim) => {
    const key = `${claim.text}:${claim.location.startChar}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 위험도 할당
 */
function assignRiskLevels(claimsList: ExtractedClaim[]): ExtractedClaim[] {
  return claimsList.map((claim) => ({
    ...claim,
    riskLevel: determineRiskLevel(claim),
  }));
}

function determineRiskLevel(claim: ExtractedClaim): RiskLevel {
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
