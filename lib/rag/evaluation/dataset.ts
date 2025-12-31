/**
 * 평가 데이터셋 로더
 *
 * JSON 형식의 평가 세트를 로드하고 검증합니다.
 */

import { readFile } from 'fs/promises';
import { resolve, isAbsolute } from 'path';
import type { EvaluationDataset, EvaluationItem, QuestionType } from './types';

const VALID_QUESTION_TYPES: QuestionType[] = [
  'factual',
  'followup',
  'comparison',
  'procedural',
  'reasoning',
  'unanswerable',
];

/**
 * 평가 데이터셋 로드
 *
 * @param path - JSON 파일 경로 (상대 또는 절대)
 * @returns 검증된 평가 데이터셋
 */
export async function loadDataset(path: string): Promise<EvaluationDataset> {
  const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path);

  const content = await readFile(absolutePath, 'utf-8');
  const data = JSON.parse(content) as unknown;

  return validateDataset(data);
}

/**
 * 데이터셋 검증
 */
function validateDataset(data: unknown): EvaluationDataset {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid dataset: must be an object');
  }

  const dataset = data as Record<string, unknown>;

  // 필수 필드 검증
  if (typeof dataset.version !== 'string') {
    throw new Error('Invalid dataset: missing or invalid "version" field');
  }

  if (typeof dataset.name !== 'string') {
    throw new Error('Invalid dataset: missing or invalid "name" field');
  }

  if (typeof dataset.tenantId !== 'string') {
    throw new Error('Invalid dataset: missing or invalid "tenantId" field');
  }

  if (!Array.isArray(dataset.items)) {
    throw new Error('Invalid dataset: missing or invalid "items" array');
  }

  // 각 항목 검증
  const validatedItems = dataset.items.map((item, index) => validateItem(item, index));

  return {
    version: dataset.version,
    name: dataset.name,
    description: typeof dataset.description === 'string' ? dataset.description : undefined,
    tenantId: dataset.tenantId,
    datasetIds: Array.isArray(dataset.datasetIds) ? dataset.datasetIds : undefined,
    items: validatedItems,
    createdAt: typeof dataset.createdAt === 'string' ? dataset.createdAt : new Date().toISOString(),
    updatedAt: typeof dataset.updatedAt === 'string' ? dataset.updatedAt : new Date().toISOString(),
  };
}

/**
 * 개별 항목 검증
 */
function validateItem(item: unknown, index: number): EvaluationItem {
  if (!item || typeof item !== 'object') {
    throw new Error(`Invalid item at index ${index}: must be an object`);
  }

  const data = item as Record<string, unknown>;

  if (typeof data.id !== 'string') {
    throw new Error(`Invalid item at index ${index}: missing or invalid "id" field`);
  }

  if (typeof data.question !== 'string') {
    throw new Error(`Invalid item at index ${index}: missing or invalid "question" field`);
  }

  if (typeof data.questionType !== 'string' || !VALID_QUESTION_TYPES.includes(data.questionType as QuestionType)) {
    throw new Error(
      `Invalid item at index ${index}: invalid "questionType". Must be one of: ${VALID_QUESTION_TYPES.join(', ')}`
    );
  }

  if (typeof data.groundTruth !== 'string') {
    throw new Error(`Invalid item at index ${index}: missing or invalid "groundTruth" field`);
  }

  // 선택적 필드 검증
  let conversationHistory: EvaluationItem['conversationHistory'];
  if (data.conversationHistory !== undefined) {
    if (!Array.isArray(data.conversationHistory)) {
      throw new Error(`Invalid item at index ${index}: "conversationHistory" must be an array`);
    }

    conversationHistory = data.conversationHistory.map((msg, msgIndex) => {
      if (!msg || typeof msg !== 'object') {
        throw new Error(`Invalid conversation message at item ${index}, message ${msgIndex}`);
      }

      const message = msg as Record<string, unknown>;
      if (message.role !== 'user' && message.role !== 'assistant') {
        throw new Error(`Invalid role in conversation at item ${index}, message ${msgIndex}`);
      }

      if (typeof message.content !== 'string') {
        throw new Error(`Invalid content in conversation at item ${index}, message ${msgIndex}`);
      }

      return {
        role: message.role as 'user' | 'assistant',
        content: message.content,
      };
    });
  }

  return {
    id: data.id,
    question: data.question,
    questionType: data.questionType as QuestionType,
    groundTruth: data.groundTruth,
    groundTruthChunks: Array.isArray(data.groundTruthChunks) ? data.groundTruthChunks : undefined,
    conversationHistory,
    metadata: typeof data.metadata === 'object' && data.metadata !== null
      ? (data.metadata as Record<string, unknown>)
      : undefined,
  };
}

/**
 * 데이터셋 통계 계산
 */
export function getDatasetStats(dataset: EvaluationDataset): {
  totalItems: number;
  byQuestionType: Record<QuestionType, number>;
  withConversationHistory: number;
  withGroundTruthChunks: number;
} {
  const byQuestionType = {} as Record<QuestionType, number>;
  let withConversationHistory = 0;
  let withGroundTruthChunks = 0;

  for (const item of dataset.items) {
    byQuestionType[item.questionType] = (byQuestionType[item.questionType] || 0) + 1;

    if (item.conversationHistory?.length) {
      withConversationHistory++;
    }

    if (item.groundTruthChunks?.length) {
      withGroundTruthChunks++;
    }
  }

  return {
    totalItems: dataset.items.length,
    byQuestionType,
    withConversationHistory,
    withGroundTruthChunks,
  };
}
