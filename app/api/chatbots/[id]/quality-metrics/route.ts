/**
 * Phase 5: A/B 테스트 품질 메트릭 API
 *
 * GET /api/chatbots/:id/quality-metrics - 전략별 품질 메트릭 조회
 *
 * @see docs/testplans/phase5-ab-test-quality-validation.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import {
  getQualityMetricsByStrategy,
  extractABTestResult,
} from '@/lib/rag/quality-metrics';
import type { QualityMetricsResponse } from '@/types/experiment';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id/quality-metrics
 *
 * 챗봇의 청킹 전략별 품질 메트릭을 조회합니다.
 *
 * Query Parameters:
 * - from: 조회 시작일 (ISO 8601, 선택)
 * - to: 조회 종료일 (ISO 8601, 선택)
 *
 * Response:
 * - metrics: 전략별 품질 메트릭 배열
 * - abTestResult: A/B 테스트 결과 (control/treatment 모두 있는 경우)
 * - dateRange: 조회 기간
 * - queriedAt: 조회 시점
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 및 권한 확인
    const [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let dateRange: { from: Date; to: Date } | undefined;
    if (fromParam && toParam) {
      const from = new Date(fromParam);
      const to = new Date(toParam);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        dateRange = { from, to };
      }
    }

    // 전략별 품질 메트릭 조회
    const metrics = await getQualityMetricsByStrategy(id, dateRange);

    // A/B 테스트 결과 추출 (control/treatment 모두 있는 경우)
    const abTestResult = extractABTestResult(metrics);

    const response: QualityMetricsResponse = {
      metrics,
      abTestResult,
      dateRange: dateRange
        ? {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString(),
          }
        : null,
      queriedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Quality metrics error:', error);
    return NextResponse.json(
      { error: '품질 메트릭 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
