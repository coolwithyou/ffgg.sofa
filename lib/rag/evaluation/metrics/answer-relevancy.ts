/**
 * Answer Relevancy 메트릭
 *
 * 생성된 답변이 질문에 적합한지 평가합니다.
 * 질문-답변 쌍의 관련성을 LLM이 직접 평가합니다.
 *
 * RAGAS는 역질문 생성 방식을 사용하지만,
 * 비용 효율성을 위해 직접 평가 방식을 채택했습니다.
 */

import { generateWithFallback } from '../../generator';
import { logger } from '@/lib/logger';
import type { MetricResult, AnswerRelevancyAnalysis } from '../types';

/** 관련성 평가 프롬프트 */
const EVALUATE_RELEVANCY_SYSTEM_PROMPT = `당신은 질문-답변 쌍의 관련성을 평가하는 전문가입니다.

## 작업
주어진 질문에 대한 답변의 적합성을 평가하세요.

## 평가 기준
1. **직접성**: 질문의 핵심을 직접적으로 다루고 있는가?
2. **완전성**: 질문에서 요구하는 정보를 충분히 제공하는가?
3. **정확성**: 질문 유형에 맞는 형식으로 답변하는가?
4. **간결성**: 불필요한 정보 없이 핵심만 전달하는가?

## 점수 기준
- 1.0: 질문에 완벽하게 적합한 답변
- 0.8: 대부분 적합하지만 약간의 개선 여지 있음
- 0.6: 부분적으로 적합함
- 0.4: 관련은 있으나 질문에 제대로 답하지 못함
- 0.2: 거의 관련 없음
- 0.0: 전혀 관련 없음

## 출력 형식
JSON 형식으로 출력하세요:
{
  "score": 0.0-1.0,
  "addressesQuestion": true/false,
  "reasoning": "판단 근거를 구체적으로 설명",
  "partiallyAddressed": ["부분적으로만 답변된 항목들"]
}`;

/**
 * Answer Relevancy 메트릭 평가
 *
 * @param question - 원본 질문
 * @param answer - 생성된 답변
 * @returns 점수 (0-1)와 상세 분석 결과
 */
export async function evaluateAnswerRelevancy(
  question: string,
  answer: string
): Promise<MetricResult<AnswerRelevancyAnalysis>> {
  const userPrompt = `## 질문
${question}

## 답변
${answer}

## 평가 결과 (JSON)`;

  try {
    const response = await generateWithFallback(EVALUATE_RELEVANCY_SYSTEM_PROMPT, userPrompt, {
      temperature: 0.1,
      maxTokens: 400,
    });

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Failed to extract JSON from relevancy response', { response });
      return {
        score: 0.5,
        analysis: {
          relevanceReasoning: 'Failed to parse evaluation response',
          addressesQuestion: false,
        },
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      score?: number;
      addressesQuestion?: boolean;
      reasoning?: string;
      partiallyAddressed?: string[];
    };

    // 점수 범위 검증
    const score = Math.max(0, Math.min(1, parsed.score ?? 0.5));

    return {
      score,
      analysis: {
        relevanceReasoning: parsed.reasoning ?? 'No reasoning provided',
        addressesQuestion: parsed.addressesQuestion ?? false,
        partiallyAddressed: parsed.partiallyAddressed,
      },
    };
  } catch (error) {
    logger.error('Failed to evaluate answer relevancy', error as Error, { question, answer });
    return {
      score: 0.5,
      analysis: {
        relevanceReasoning: 'Evaluation failed due to error',
        addressesQuestion: false,
      },
    };
  }
}
