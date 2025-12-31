/**
 * Context Recall 메트릭
 *
 * 정답에 필요한 정보가 검색 결과에 포함되었는지 평가합니다.
 * groundTruthChunks가 제공된 경우에만 정확한 계산이 가능합니다.
 *
 * 평가 방법:
 * 1. 정답에서 필요한 핵심 정보 식별
 * 2. 검색된 컨텍스트에서 해당 정보 존재 여부 확인
 * 3. 점수 = 찾은 정보 수 / 필요한 정보 수
 */

import { generateWithFallback } from '../../generator';
import { logger } from '@/lib/logger';
import type { MetricResult, ContextRecallAnalysis } from '../types';

/** 정보 커버리지 평가 프롬프트 */
const EVALUATE_RECALL_SYSTEM_PROMPT = `당신은 정보 커버리지를 분석하는 전문가입니다.

## 작업
정답을 생성하기 위해 필요한 핵심 정보가 검색된 컨텍스트에 포함되어 있는지 분석하세요.

## 분석 단계
1. 정답에서 핵심 정보 요소들을 추출
2. 각 정보 요소가 컨텍스트에 있는지 확인
3. 누락된 정보 식별

## 출력 형식
JSON 형식으로 출력하세요:
{
  "requiredInfo": ["정답에 필요한 정보 1", "정답에 필요한 정보 2", ...],
  "foundInfo": ["컨텍스트에서 찾은 정보들"],
  "missingInfo": ["컨텍스트에 없는 정보들"]
}`;

/**
 * Context Recall 메트릭 평가
 *
 * @param groundTruth - 정답
 * @param context - 검색된 컨텍스트
 * @param groundTruthChunks - 정답 근거 청크 ID 목록 (선택)
 * @param retrievedChunks - 검색된 청크 목록 (선택)
 * @returns 점수 (0-1)와 상세 분석 결과
 */
export async function evaluateContextRecall(
  groundTruth: string,
  context: string,
  groundTruthChunks?: string[],
  retrievedChunks?: Array<{ chunkId: string }>
): Promise<MetricResult<ContextRecallAnalysis>> {
  // groundTruthChunks가 있으면 직접 비교 (정확한 계산)
  if (groundTruthChunks && groundTruthChunks.length > 0 && retrievedChunks) {
    const retrievedIds = new Set(retrievedChunks.map((c) => c.chunkId));
    const foundCount = groundTruthChunks.filter((id) => retrievedIds.has(id)).length;
    const score = foundCount / groundTruthChunks.length;

    return {
      score,
      analysis: {
        requiredInfo: groundTruthChunks,
        foundInfo: groundTruthChunks.filter((id) => retrievedIds.has(id)),
        missingInfo: groundTruthChunks.filter((id) => !retrievedIds.has(id)),
      },
    };
  }

  // groundTruthChunks가 없으면 LLM으로 정보 커버리지 분석
  const userPrompt = `## 정답 (이 내용을 생성하기 위해 필요한 정보를 분석)
${groundTruth}

## 검색된 컨텍스트
${context}

## 분석 결과 (JSON)`;

  try {
    const response = await generateWithFallback(EVALUATE_RECALL_SYSTEM_PROMPT, userPrompt, {
      temperature: 0.1,
      maxTokens: 500,
    });

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Failed to extract JSON from recall response', { response });
      return {
        score: 0.5,
        analysis: {
          requiredInfo: [],
          foundInfo: [],
          missingInfo: [],
        },
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      requiredInfo?: string[];
      foundInfo?: string[];
      missingInfo?: string[];
    };

    const requiredInfo = parsed.requiredInfo ?? [];
    const foundInfo = parsed.foundInfo ?? [];
    const missingInfo = parsed.missingInfo ?? [];

    // 점수 계산: 찾은 정보 비율
    const totalRequired = requiredInfo.length || 1;
    const score = foundInfo.length / totalRequired;

    return {
      score: Math.min(1, score), // 1을 초과하지 않도록
      analysis: {
        requiredInfo,
        foundInfo,
        missingInfo,
      },
    };
  } catch (error) {
    logger.error('Failed to evaluate context recall', error as Error);
    return {
      score: 0.5,
      analysis: {
        requiredInfo: [],
        foundInfo: [],
        missingInfo: [],
      },
    };
  }
}
