// lib/knowledge-pages/verification/regex-verifier.ts

import { db } from '@/lib/db';
import { claims, sourceSpans, validationSessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import Fuse from 'fuse.js';
import type { MatchMethod } from '../types';

interface MatchResult {
  found: boolean;
  matchedText: string;
  startChar: number;
  endChar: number;
  pageNumber?: number;
  score: number;
  method: MatchMethod;
}

interface ClaimToVerify {
  id: string;
  claimText: string;
  claimType: string;
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
  claimsToVerify: ClaimToVerify[]
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
          verificationDetail:
            result.method === 'exact'
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
    const normalizedResult = findNormalizedContactMatch(
      originalText,
      normalizedClaim
    );

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

  return {
    found: false,
    matchedText: '',
    startChar: 0,
    endChar: 0,
    score: 0,
    method: 'exact',
  };
}

/**
 * 숫자 정규화
 */
function normalizeNumeric(text: string): string {
  return text
    .replace(/[,.\s]/g, '') // 쉼표, 점, 공백 제거
    .replace(/원|만원|억원/g, '') // 단위 제거
    .replace(/개|명|건|회|%/g, ''); // 단위 제거
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
  const numberPattern =
    /\d{1,3}(,\d{3})*(\.\d+)?\s*(원|만원|억원|개|명|건|회|%)?/g;
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

  const fuse = new Fuse(
    chunks.map((c) => c.text),
    {
      includeScore: true,
      threshold: 0.4,
      distance: 100,
    }
  );

  const results = fuse.search(searchText);

  if (results.length > 0 && results[0].score !== undefined) {
    const bestMatch = results[0];
    const matchedChunk = chunks[bestMatch.refIndex];
    // TypeScript narrowing: 위에서 score !== undefined 체크했으므로 안전
    const score = bestMatch.score ?? 0;

    return {
      text: matchedChunk.text,
      startChar: matchedChunk.startChar,
      endChar: matchedChunk.endChar,
      score: 1 - score, // Fuse.js score는 낮을수록 좋음
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
