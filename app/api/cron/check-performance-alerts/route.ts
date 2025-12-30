/**
 * 성능 알림 체크 Cron API
 * 15분마다 실행되어 응답 시간 관련 알림을 확인합니다.
 *
 * Vercel Cron 설정 예시 (vercel.json):
 * { "path": "/api/cron/check-performance-alerts", "schedule": "*\/15 * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAllResponseTimeAlerts } from '@/lib/alerts/response-time-checker';
import { logger } from '@/lib/logger';

// Cron 보안 키 (환경변수로 설정)
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 또는 Authorization 헤더로 인증
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-vercel-cron');

    if (CRON_SECRET && !cronHeader) {
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const startTime = Date.now();

    // 응답 시간 알림 체크
    const alerts = await checkAllResponseTimeAlerts();

    const duration = Date.now() - startTime;

    // 알림이 있으면 처리 (이메일/슬랙 전송 등)
    // TODO: 알림 전송 로직 연동 (lib/alerts/sender.ts)
    if (alerts.length > 0) {
      logger.warn('Performance alerts detected', {
        alertCount: alerts.length,
        alerts: alerts.map((a) => ({
          tenantId: a.tenantId,
          type: a.type,
          message: a.message,
        })),
      });
    }

    logger.info('Performance alert check cron completed', {
      alertCount: alerts.length,
      duration,
    });

    return NextResponse.json({
      success: true,
      alertCount: alerts.length,
      alerts: alerts.map((a) => ({
        tenantId: a.tenantId,
        tenantName: a.tenantName,
        type: a.type,
        severity: a.severity,
        message: a.message,
        createdAt: a.createdAt,
      })),
      duration,
    });
  } catch (error) {
    logger.error('Performance alert check cron failed', error as Error);

    return NextResponse.json(
      { error: 'Alert check failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST도 지원 (외부 스케줄러용)
export async function POST(request: NextRequest) {
  return GET(request);
}
