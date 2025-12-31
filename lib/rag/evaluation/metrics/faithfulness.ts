/**
 * Faithfulness 메트릭
 *
 * 생성된 답변이 검색된 컨텍스트에 충실한지 평가합니다.
 * RAGAS의 Faithfulness 메트릭을 참고하여 구현되었습니다.
 *
 * 평가 방법:
 * 1. 답변에서 사실적 주장(claims) 추출
 * 2. 각 주장이 컨텍스트에서 지지되는지 LLM으로 검증
 * 3. 점수 = 지지되는 주장 수 / 전체 주장 수
 */

import { generateWithFallback } from '../../generator';
import { logger } from '@/lib/logger';
import type { MetricResult, FaithfulnessAnalysis } from '../types';

/** 주장 추출 프롬프트 */
const EXTRACT_CLAIMS_SYSTEM_PROMPT = `당신은 텍스트에서 사실적 주장을 추출하는 전문가입니다.

## 작업
주어진 답변에서 검증 가능한 사실적 주장(claims)을 추출하세요.

## 규칙
1. 명확한 사실적 진술만 추출 (의견, 추측 제외)
2. 각 주장은 독립적으로 검증 가능해야 함
3. 복합 문장은 개별 주장으로 분리
4. 질문에 대한 답변이 아닌 문장은 제외

## 출력 형식
JSON 형식으로 출력하세요:
{"claims": ["주장1", "주장2", ...]}

주장이 없으면:
{"claims": []}`;

/** 주장 검증 프롬프트 */
const VERIFY_CLAIM_SYSTEM_PROMPT = `당신은 주장의 근거를 검증하는 전문가입니다.

## 작업
주어진 주장이 컨텍스트에서 지지되는지 판단하세요.

## 판단 기준
- "supported": 컨텍스트에서 직접 확인 가능하거나 명확히 추론 가능
- "not_supported": 컨텍스트에 근거가 없음
- "contradicted": 컨텍스트와 명백히 모순됨

## 출력 형식
JSON 형식으로 출력하세요:
{"verdict": "supported|not_supported|contradicted", "evidence": "근거 문장 또는 판단 이유"}`;

/**
 * 답변에서 사실적 주장 추출
 */
async function extractClaims(answer: string): Promise<string[]> {
  const userPrompt = `## 답변
${answer}

## 추출된 주장 (JSON)`;

  try {
    const response = await generateWithFallback(EXTRACT_CLAIMS_SYSTEM_PROMPT, userPrompt, {
      temperature: 0.1,
      maxTokens: 500,
    });

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Failed to extract JSON from claims response', { response });
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as { claims?: string[] };
    return Array.isArray(parsed.claims) ? parsed.claims : [];
  } catch (error) {
    logger.error('Failed to extract claims', error as Error, { answer });
    return [];
  }
}

/**
 * 단일 주장 검증
 */
async function verifyClaim(
  claim: string,
  context: string
): Promise<{ supported: boolean; evidence?: string }> {
  const userPrompt = `## 컨텍스트
${context}

## 검증할 주장
${claim}

## 판단 결과 (JSON)`;

  try {
    const response = await generateWithFallback(VERIFY_CLAIM_SYSTEM_PROMPT, userPrompt, {
      temperature: 0.1,
      maxTokens: 300,
    });

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Failed to extract JSON from verification response', { response });
      return { supported: false };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { verdict?: string; evidence?: string };
    return {
      supported: parsed.verdict === 'supported',
      evidence: parsed.evidence,
    };
  } catch (error) {
    logger.error('Failed to verify claim', error as Error, { claim });
    return { supported: false };
  }
}

/**
 * Faithfulness 메트릭 평가
 *
 * @param answer - 생성된 답변
 * @param context - 검색된 컨텍스트 (청크들의 내용)
 * @returns 점수 (0-1)와 상세 분석 결과
 */
export async function evaluateFaithfulness(
  answer: string,
  context: string
): Promise<MetricResult<FaithfulnessAnalysis>> {
  // 1. 주장 추출
  const claims = await extractClaims(answer);

  // 주장이 없으면 기본 점수 1.0 (검증할 것이 없음)
  if (claims.length === 0) {
    return {
      score: 1.0,
      analysis: {
        claims: [],
        unsupportedClaims: [],
      },
    };
  }

  // 2. 각 주장 검증 (병렬)
  const verificationResults = await Promise.all(
    claims.map(async (claim) => {
      const result = await verifyClaim(claim, context);
      return {
        claim,
        supportedByContext: result.supported,
        evidence: result.evidence,
      };
    })
  );

  // 3. 점수 계산
  const supportedCount = verificationResults.filter((r) => r.supportedByContext).length;
  const score = supportedCount / claims.length;

  const unsupportedClaims = verificationResults
    .filter((r) => !r.supportedByContext)
    .map((r) => r.claim);

  return {
    score,
    analysis: {
      claims: verificationResults,
      unsupportedClaims,
    },
  };
}
