'use server';

/**
 * 모니터링 서버 액션
 * [Week 10] 시스템 상태 모니터링
 */

import { validateSession } from '@/lib/auth';
import { db, documents, chunks, conversations } from '@/lib/db';
import { sql, count, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface SystemHealth {
  database: {
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    connections: number;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    requestsPerMinute: number;
    errorRate: number;
  };
  storage: {
    status: 'healthy' | 'degraded' | 'down';
    usedBytes: number;
    totalBytes: number;
  };
}

export interface UsageMetrics {
  hourly: Array<{
    hour: string;
    conversations: number;
    documents: number;
    chunks: number;
  }>;
  daily: Array<{
    date: string;
    conversations: number;
    documents: number;
  }>;
}

export interface RecentActivity {
  type: 'document' | 'conversation' | 'chunk';
  tenantId: string;
  tenantName: string;
  description: string;
  createdAt: string;
}

/**
 * 시스템 상태 조회
 */
export async function getSystemHealth(): Promise<SystemHealth | null> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    // 데이터베이스 상태 체크
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - dbStart;

    // 연결 수 조회 (PostgreSQL)
    const connectionsResult = await db.execute(sql`
      SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
    `);
    const connections = parseInt((connectionsResult[0] as { count: string })?.count || '0');

    return {
      database: {
        status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'down',
        latency: dbLatency,
        connections,
      },
      api: {
        status: 'healthy',
        requestsPerMinute: 0, // 실제로는 Redis나 메트릭 시스템에서 조회
        errorRate: 0,
      },
      storage: {
        status: 'healthy',
        usedBytes: 0, // 실제로는 Supabase Storage API에서 조회
        totalBytes: 10 * 1024 * 1024 * 1024, // 10GB 기본
      },
    };
  } catch (error) {
    logger.error('Failed to check system health', error as Error);
    return {
      database: { status: 'down', latency: 0, connections: 0 },
      api: { status: 'down', requestsPerMinute: 0, errorRate: 100 },
      storage: { status: 'down', usedBytes: 0, totalBytes: 0 },
    };
  }
}

/**
 * 사용량 메트릭 조회
 */
export async function getUsageMetrics(): Promise<UsageMetrics | null> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 시간별 통계 (최근 24시간)
    const hourlyResult = await db.execute(sql`
      SELECT
        date_trunc('hour', created_at) as hour,
        count(*) as conversations
      FROM conversations
      WHERE created_at >= ${oneDayAgo.toISOString()}
      GROUP BY date_trunc('hour', created_at)
      ORDER BY hour DESC
      LIMIT 24
    `);

    // 일별 통계 (최근 7일)
    const dailyResult = await db.execute(sql`
      SELECT
        DATE(c.created_at) as date,
        count(DISTINCT c.id) as conversations,
        count(DISTINCT d.id) as documents
      FROM conversations c
      FULL OUTER JOIN documents d ON DATE(c.created_at) = DATE(d.created_at)
      WHERE c.created_at >= ${sevenDaysAgo.toISOString()}
        OR d.created_at >= ${sevenDaysAgo.toISOString()}
      GROUP BY DATE(c.created_at)
      ORDER BY date DESC
      LIMIT 7
    `);

    return {
      hourly: (hourlyResult as unknown as Array<{
        hour: Date;
        conversations: string;
      }>).map((row) => ({
        hour: row.hour instanceof Date
          ? row.hour.toISOString()
          : String(row.hour),
        conversations: parseInt(row.conversations) || 0,
        documents: 0,
        chunks: 0,
      })),
      daily: (dailyResult as unknown as Array<{
        date: Date;
        conversations: string;
        documents: string;
      }>).map((row) => ({
        date: row.date instanceof Date
          ? row.date.toISOString().split('T')[0]
          : String(row.date),
        conversations: parseInt(row.conversations) || 0,
        documents: parseInt(row.documents) || 0,
      })),
    };
  } catch (error) {
    logger.error('Failed to fetch usage metrics', error as Error);
    return null;
  }
}

/**
 * 최근 활동 조회
 */
export async function getRecentActivities(): Promise<RecentActivity[]> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return [];
  }

  try {
    // 최근 문서 업로드
    const recentDocs = await db.execute(sql`
      SELECT
        d.id,
        d.filename,
        d.created_at,
        t.id as tenant_id,
        t.name as tenant_name,
        t.email as tenant_email
      FROM documents d
      JOIN tenants t ON d.tenant_id = t.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `);

    // 최근 대화
    const recentConvs = await db.execute(sql`
      SELECT
        c.id,
        c.session_id,
        c.created_at,
        t.id as tenant_id,
        t.name as tenant_name,
        t.email as tenant_email
      FROM conversations c
      JOIN tenants t ON c.tenant_id = t.id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    const activities: RecentActivity[] = [];

    (recentDocs as unknown as Array<{
      id: string;
      filename: string;
      created_at: Date | string;
      tenant_id: string;
      tenant_name: string | null;
      tenant_email: string;
    }>).forEach((row) => {
      activities.push({
        type: 'document',
        tenantId: row.tenant_id,
        tenantName: row.tenant_name || row.tenant_email.split('@')[0],
        description: `문서 업로드: ${row.filename}`,
        createdAt: row.created_at instanceof Date
          ? row.created_at.toISOString()
          : (row.created_at ? String(row.created_at) : new Date().toISOString()),
      });
    });

    (recentConvs as unknown as Array<{
      id: string;
      session_id: string;
      created_at: Date | string;
      tenant_id: string;
      tenant_name: string | null;
      tenant_email: string;
    }>).forEach((row) => {
      activities.push({
        type: 'conversation',
        tenantId: row.tenant_id,
        tenantName: row.tenant_name || row.tenant_email.split('@')[0],
        description: `새 상담 시작`,
        createdAt: row.created_at instanceof Date
          ? row.created_at.toISOString()
          : (row.created_at ? String(row.created_at) : new Date().toISOString()),
      });
    });

    // 시간순 정렬
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);
  } catch (error) {
    logger.error('Failed to fetch recent activities', error as Error);
    return [];
  }
}
