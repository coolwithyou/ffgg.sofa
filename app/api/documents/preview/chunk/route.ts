/**
 * AI 시맨틱 청킹 미리보기 API (2단계)
 *
 * 파싱된 텍스트를 AI로 시맨틱 청킹하고 포인트를 차감합니다.
 *
 * 2단계 플로우:
 * 1단계: 파싱 + 텍스트 미리보기 (/api/documents/preview/parse)
 * 2단계: AI 시맨틱 청킹 (이 API) - 포인트 소모
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { semanticChunk, type SemanticChunk } from '@/lib/rag/semantic-chunking';
import {
  estimateChunkingCost,
  SEGMENT_SIZE,
  POINTS_PER_SEGMENT,
} from '@/lib/rag/chunk-cost-estimator';
import { POINT_TRANSACTION_TYPES } from '@/lib/points/constants';
import { getPointBalance } from '@/lib/points/service';
import { db } from '@/lib/db';
import { tenantPoints, pointTransactions } from '@/drizzle/schema';
import { logger } from '@/lib/logger';

// ============================================================
// 타입
// ============================================================

interface ChunkPreview {
  index: number;
  content: string;
  contentPreview: string;
  type: SemanticChunk['type'];
  topic: string;
  qualityScore: number;
  autoApproved: boolean;
}

interface ChunkWarning {
  type: 'too_short' | 'too_long' | 'incomplete_qa' | 'low_quality';
  count: number;
  message: string;
}

export interface ChunkPreviewResponse {
  success: true;
  chunks: ChunkPreview[];
  summary: {
    totalChunks: number;
    avgQualityScore: number;
    autoApprovedCount: number;
    pendingCount: number;
    warnings: ChunkWarning[];
  };
  usage: {
    pointsConsumed: number;
    processingTime: number;
    segmentCount: number;
  };
}

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 청크 품질 점수 계산
 * semantic-chunking의 출력에서 품질을 평가
 */
function calculateQualityScore(chunk: SemanticChunk): number {
  let score = 70; // 기본 점수

  // 1. 길이 평가 (100-600자가 이상적)
  const len = chunk.content.length;
  if (len >= 100 && len <= 600) {
    score += 15;
  } else if (len >= 50 && len <= 800) {
    score += 8;
  } else if (len < 50 || len > 1000) {
    score -= 10;
  }

  // 2. 타입 평가
  if (chunk.type === 'qa') {
    // Q&A 쌍이 완전한지 확인
    const hasQuestion = chunk.content.includes('Q:') || chunk.content.includes('질문:');
    const hasAnswer = chunk.content.includes('A:') || chunk.content.includes('답변:');
    if (hasQuestion && hasAnswer) {
      score += 10;
    } else if (hasQuestion || hasAnswer) {
      score -= 10; // 불완전한 Q&A
    }
  } else if (chunk.type === 'table' || chunk.type === 'code') {
    score += 5; // 구조화된 콘텐츠
  }

  // 3. 토픽 있음 여부
  if (chunk.topic && chunk.topic.length > 0) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * 시맨틱 청킹용 포인트 차감
 */
async function consumeChunkingPoints(
  tenantId: string,
  segmentCount: number
): Promise<{ newBalance: number; transactionId: string; pointsConsumed: number }> {
  const pointsToConsume = Math.max(1, segmentCount * POINTS_PER_SEGMENT);

  // 현재 잔액 확인
  const currentBalance = await getPointBalance(tenantId);

  if (currentBalance < pointsToConsume) {
    throw new Error(`포인트가 부족합니다. 필요: ${pointsToConsume}P, 보유: ${currentBalance}P`);
  }

  // 원자적 차감
  const [updated] = await db
    .update(tenantPoints)
    .set({
      balance: sql`GREATEST(${tenantPoints.balance} - ${pointsToConsume}, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantPoints.tenantId, tenantId),
        sql`${tenantPoints.balance} >= ${pointsToConsume}`
      )
    )
    .returning();

  if (!updated) {
    throw new Error('포인트 차감 중 오류가 발생했습니다');
  }

  // 거래 이력 기록
  const [transaction] = await db
    .insert(pointTransactions)
    .values({
      tenantId,
      type: POINT_TRANSACTION_TYPES.SEMANTIC_CHUNKING,
      amount: -pointsToConsume,
      balance: updated.balance,
      description: `AI 시맨틱 청킹 (${segmentCount}세그먼트)`,
      metadata: {
        segmentCount,
        segmentSize: SEGMENT_SIZE,
      },
    })
    .returning();

  return {
    newBalance: updated.balance,
    transactionId: transaction.id,
    pointsConsumed: pointsToConsume,
  };
}

// ============================================================
// API 핸들러
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Rate Limiting
  const rateLimitResponse = await withRateLimit(request, 'upload', 'premium');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // 2. 인증 및 테넌트 격리
  const isolation = await withTenantIsolation(request);
  if (!isolation.success) {
    return isolation.response;
  }

  const { tenant } = isolation;

  try {
    // JSON 파싱
    const body = await request.json();
    const { text } = body as { text?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: '텍스트가 필요합니다.' },
        { status: 400 }
      );
    }

    // 비용 추정
    const estimation = estimateChunkingCost(text.length);

    // 포인트 충분한지 확인
    const currentBalance = await getPointBalance(tenant.tenantId);
    if (currentBalance < estimation.estimatedPoints) {
      return NextResponse.json(
        {
          error: '포인트가 부족합니다.',
          required: estimation.estimatedPoints,
          balance: currentBalance,
        },
        { status: 402 } // Payment Required
      );
    }

    // AI 시맨틱 청킹 수행
    const semanticChunks = await semanticChunk(
      text,
      {
        preChunkSize: SEGMENT_SIZE,
        minChunkSize: 100,
        maxChunkSize: 600,
      },
      undefined,
      { tenantId: tenant.tenantId }
    );

    // 포인트 차감 (실제 세그먼트 수 기준)
    const actualSegmentCount = Math.max(1, Math.ceil(text.length / SEGMENT_SIZE));
    const { pointsConsumed, transactionId } = await consumeChunkingPoints(
      tenant.tenantId,
      actualSegmentCount
    );

    // 청크 프리뷰 생성
    const chunkPreviews: ChunkPreview[] = semanticChunks.map((chunk) => {
      const qualityScore = calculateQualityScore(chunk);
      return {
        index: chunk.index,
        content: chunk.content,
        contentPreview:
          chunk.content.length > 200
            ? chunk.content.slice(0, 200) + '...'
            : chunk.content,
        type: chunk.type,
        topic: chunk.topic,
        qualityScore,
        autoApproved: qualityScore >= 85,
      };
    });

    // 경고 분석
    const warnings: ChunkWarning[] = [];

    // 너무 짧은 청크
    const shortChunks = chunkPreviews.filter((c) => c.content.length < 100);
    if (shortChunks.length > 0) {
      warnings.push({
        type: 'too_short',
        count: shortChunks.length,
        message: `${shortChunks.length}개 청크가 100자 미만으로 짧습니다.`,
      });
    }

    // 너무 긴 청크
    const longChunks = chunkPreviews.filter((c) => c.content.length > 800);
    if (longChunks.length > 0) {
      warnings.push({
        type: 'too_long',
        count: longChunks.length,
        message: `${longChunks.length}개 청크가 800자를 초과합니다.`,
      });
    }

    // 불완전한 Q&A
    const incompleteQA = chunkPreviews.filter(
      (c) =>
        (c.content.includes('Q:') || c.content.includes('질문:')) &&
        !(c.content.includes('A:') || c.content.includes('답변:'))
    );
    if (incompleteQA.length > 0) {
      warnings.push({
        type: 'incomplete_qa',
        count: incompleteQA.length,
        message: `${incompleteQA.length}개 Q&A 쌍이 불완전합니다.`,
      });
    }

    // 낮은 품질
    const lowQualityChunks = chunkPreviews.filter((c) => c.qualityScore < 50);
    if (lowQualityChunks.length > 0) {
      warnings.push({
        type: 'low_quality',
        count: lowQualityChunks.length,
        message: `${lowQualityChunks.length}개 청크의 품질 점수가 50점 미만입니다.`,
      });
    }

    // 요약 계산
    const totalChunks = chunkPreviews.length;
    const avgQualityScore =
      totalChunks > 0
        ? chunkPreviews.reduce((sum, c) => sum + c.qualityScore, 0) / totalChunks
        : 0;
    const autoApprovedCount = chunkPreviews.filter((c) => c.autoApproved).length;
    const pendingCount = totalChunks - autoApprovedCount;

    const processingTime = Date.now() - startTime;

    logger.info('Document chunk preview completed', {
      tenantId: tenant.tenantId,
      textLength: text.length,
      totalChunks,
      avgQualityScore: avgQualityScore.toFixed(2),
      pointsConsumed,
      transactionId,
      processingTime,
    });

    const response: ChunkPreviewResponse = {
      success: true,
      chunks: chunkPreviews,
      summary: {
        totalChunks,
        avgQualityScore,
        autoApprovedCount,
        pendingCount,
        warnings,
      },
      usage: {
        pointsConsumed,
        processingTime,
        segmentCount: actualSegmentCount,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      'Document chunk preview failed',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId: tenant.tenantId }
    );

    // 포인트 부족 에러는 402로 반환
    if (error instanceof Error && error.message.includes('포인트가 부족')) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 청킹 실패' },
      { status: 500 }
    );
  }
}
