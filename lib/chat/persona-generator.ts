/**
 * 페르소나 자동 생성 모듈
 * RAG 문서 청크를 분석하여 챗봇 페르소나를 자동 생성합니다.
 */

import { generateWithFallback } from '@/lib/rag/generator';
import { getChunksByDatasets } from '@/lib/rag/retrieval';
import { getChatbotDatasetIds } from './chatbot';
import { logger } from '@/lib/logger';
import type { PersonaConfig } from './intent-classifier';

export interface GeneratedPersona extends PersonaConfig {
  keywords: string[];
  confidence: number;
  /** 분석에 사용된 청크 수 */
  analyzedChunkCount: number;
  /** 분석에 포함된 고유 문서 수 */
  analyzedDocumentCount: number;
}

export interface GeneratePersonaOptions {
  /** 분석할 청크 수 (기본: 50) */
  sampleSize?: number;
  tenantId: string;
}

const PERSONA_GENERATION_PROMPT = `당신은 기업 문서를 분석하여 AI 챗봇의 페르소나를 생성하는 전문가입니다.

## 분석할 문서 샘플
아래는 기업의 FAQ/문서에서 추출한 텍스트 청크입니다:

{chunks}

## 작업
위 문서들을 분석하여 다음 정보를 JSON 형식으로 추출하세요:

1. **keywords**: 이 기업/서비스의 핵심 키워드 5-10개 (배열)
2. **expertiseArea**: 이 챗봇의 전문 분야를 한 문장으로 요약 (100자 이내)
3. **expertiseDescription**: 전문 분야에 대한 상세 설명 (300자 이내)
   - 어떤 종류의 질문에 답변할 수 있는지
   - 주요 서비스/제품 카테고리
   - 고객이 자주 묻는 질문 유형
4. **includedTopics**: 이 챗봇이 답변해야 하는 주요 주제/키워드 5-15개 (배열)
   - 문서에서 자주 등장하는 제품명, 서비스명, 기술 용어 등
5. **excludedTopics**: 이 챗봇의 범위를 벗어나는 주제 3-5개 (배열)
   - 문서에 언급되지 않은 일반적인 범위 외 주제 추천
   - 예: 코딩, 주식, 날씨, 의료 상담 등
6. **tone**: 문서의 어조를 분석하여 추천 ("professional", "friendly", "casual" 중 하나)
7. **confidence**: 분석 신뢰도 (0.0 ~ 1.0)

## 응답 형식 (JSON만 출력)
{
  "keywords": ["키워드1", "키워드2", ...],
  "expertiseArea": "전문 분야 요약",
  "expertiseDescription": "전문 분야에 대한 상세 설명. 이 챗봇은 ~에 대해 답변합니다.",
  "includedTopics": ["주제1", "주제2", ...],
  "excludedTopics": ["코딩", "주식", ...],
  "tone": "friendly",
  "confidence": 0.85
}`;

/**
 * 챗봇에 연결된 데이터셋의 문서를 분석하여 페르소나를 자동 생성합니다.
 */
export async function generatePersonaFromDocuments(
  chatbotId: string,
  options: GeneratePersonaOptions
): Promise<GeneratedPersona> {
  const { sampleSize = 50, tenantId } = options;

  // 1. 챗봇에 연결된 데이터셋 조회
  const datasetIds = await getChatbotDatasetIds(chatbotId);
  if (datasetIds.length === 0) {
    throw new Error('연결된 데이터셋이 없습니다. 먼저 데이터셋을 연결해주세요.');
  }

  // 2. 청크 샘플링
  const chunks = await getChunksByDatasets(tenantId, datasetIds, sampleSize);
  if (chunks.length === 0) {
    throw new Error(
      '분석할 문서 청크가 없습니다. 문서를 먼저 업로드하고 승인해주세요.'
    );
  }

  // 3. 청크 내용 결합 (토큰 제한 고려하여 앞부분만)
  const chunksText = chunks
    .map((c, i) => `[${i + 1}] ${c.content.slice(0, 500)}`)
    .join('\n\n');

  const prompt = PERSONA_GENERATION_PROMPT.replace('{chunks}', chunksText);

  // 4. LLM으로 분석
  const systemPrompt =
    '당신은 문서 분석 전문가입니다. 반드시 유효한 JSON만 출력하세요.';

  try {
    const response = await generateWithFallback(systemPrompt, prompt, {
      temperature: 0.3,
      maxTokens: 800, // 상세 설명이 추가되어 토큰 증가
      trackingContext: {
        tenantId,
        chatbotId,
        featureType: 'context_generation',
      },
    });

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('유효한 JSON 응답을 받지 못했습니다.');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 필수 필드 검증
    if (!parsed.expertiseArea || !parsed.tone || !parsed.keywords) {
      throw new Error('응답에 필수 필드가 누락되었습니다.');
    }

    // tone 값 검증
    const validTones = ['professional', 'friendly', 'casual'];
    if (!validTones.includes(parsed.tone)) {
      parsed.tone = 'friendly'; // 기본값으로 폴백
    }

    // 배열 필드 검증 및 기본값
    const includedTopics = Array.isArray(parsed.includedTopics)
      ? parsed.includedTopics.slice(0, 20)
      : [];
    const excludedTopics = Array.isArray(parsed.excludedTopics)
      ? parsed.excludedTopics.slice(0, 20)
      : [];

    // 고유 문서 수 계산
    const uniqueDocumentIds = new Set(chunks.map((c) => c.documentId));
    const analyzedDocumentCount = uniqueDocumentIds.size;

    logger.info('Persona generated from documents', {
      chatbotId,
      chunksAnalyzed: chunks.length,
      documentsAnalyzed: analyzedDocumentCount,
      keywords: parsed.keywords,
      includedTopics: includedTopics.length,
      excludedTopics: excludedTopics.length,
      confidence: parsed.confidence,
    });

    return {
      name: 'AI 어시스턴트', // 이름은 기본값 유지
      expertiseArea: parsed.expertiseArea,
      expertiseDescription: parsed.expertiseDescription || '',
      includedTopics,
      excludedTopics,
      tone: parsed.tone,
      keywords: parsed.keywords || [],
      confidence: parsed.confidence || 0.7,
      analyzedChunkCount: chunks.length,
      analyzedDocumentCount,
    };
  } catch (error) {
    logger.error('Persona generation failed', error as Error, { chatbotId });

    // JSON 파싱 에러 등은 사용자에게 친화적인 메시지로 변환
    if (error instanceof SyntaxError) {
      throw new Error('AI 응답을 파싱하는데 실패했습니다. 다시 시도해주세요.');
    }

    // 기존 에러 메시지가 있으면 그대로 전달
    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error('페르소나 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
}
