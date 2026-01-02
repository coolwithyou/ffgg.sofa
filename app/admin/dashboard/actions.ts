'use server';

/**
 * 관리자 대시보드 서버 액션
 * [Week 10] 전체 시스템 현황 조회
 */

import { validateSession } from '@/lib/auth';
import { db, tenants, documents, chunks, conversations } from '@/lib/db';
import { sql, count } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import {
  getUsageOverview,
  getForecast,
  getCacheCostComparison,
  detectAnomalies,
} from '@/lib/usage/cost-calculator';
import type { UsageOverview, Forecast, CacheCostComparison } from '@/lib/usage/types';

export interface SystemStats {
  totalTenants: number;
  activeTenants: number;
  totalDocuments: number;
  totalChunks: number;
  approvedChunks: number;
  totalConversations: number;
  todayConversations: number;
  weeklyConversations: number;
}

export interface TenantUsage {
  id: string;
  name: string;
  email: string;
  status: string;
  documentCount: number;
  chunkCount: number;
  conversationCount: number;
  createdAt: string;
}

// AI 사용량 요약 (운영 대시보드용)
export interface AIUsageSummary {
  todayCostUsd: number;
  todayTokens: number;
  monthCostUsd: number;
  monthTokens: number;
  forecastCostUsd: number;
  cacheHitRate: number;
  estimatedSavings: number;
  anomalyCount: number;
}

export interface AdminDashboardData {
  stats: SystemStats;
  topTenants: TenantUsage[];
  aiUsage: AIUsageSummary;
  anomalies: Array<{
    tenantId: string;
    tenantName: string;
    todayCost: number;
    increaseRatio: number;
  }>;
  recentErrors: Array<{
    id: string;
    type: string;
    message: string;
    tenantId: string;
    createdAt: string;
  }>;
}

/**
 * 관리자 대시보드 데이터 조회
 */
export async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 병렬로 통계 조회 (기존 5개 + AI 사용량 4개)
    const [
      tenantStats,
      documentCount,
      chunkStats,
      conversationStats,
      topTenantsData,
      // AI 사용량 데이터
      todayUsage,
      monthUsage,
      forecast,
      cacheCost,
      anomaliesRaw,
    ] = await Promise.all([
      // 테넌트 통계
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where status = 'active')`,
        })
        .from(tenants),

      // 문서 수
      db.select({ count: count() }).from(documents),

      // 청크 통계
      db
        .select({
          total: count(),
          approved: sql<number>`count(*) filter (where status = 'approved')`,
        })
        .from(chunks),

      // 대화 통계
      db
        .select({
          total: count(),
          today: sql<number>`count(*) filter (where created_at >= ${todayStart.toISOString()})`,
          weekly: sql<number>`count(*) filter (where created_at >= ${weekAgo.toISOString()})`,
        })
        .from(conversations),

      // 상위 테넌트 (사용량 기준)
      db.execute(sql`
        SELECT
          t.id,
          t.name,
          t.email,
          t.status,
          COALESCE(d.doc_count, 0) as document_count,
          COALESCE(c.chunk_count, 0) as chunk_count,
          COALESCE(cv.conv_count, 0) as conversation_count,
          t.created_at
        FROM tenants t
        LEFT JOIN (
          SELECT tenant_id, count(*) as doc_count
          FROM documents
          GROUP BY tenant_id
        ) d ON d.tenant_id = t.id
        LEFT JOIN (
          SELECT documents.tenant_id, count(*) as chunk_count
          FROM chunks
          JOIN documents ON chunks.document_id = documents.id
          GROUP BY documents.tenant_id
        ) c ON c.tenant_id = t.id
        LEFT JOIN (
          SELECT tenant_id, count(*) as conv_count
          FROM conversations
          GROUP BY tenant_id
        ) cv ON cv.tenant_id = t.id
        ORDER BY conv_count DESC
        LIMIT 10
      `),

      // AI 사용량: 오늘
      getUsageOverview('today'),
      // AI 사용량: 이번 달
      getUsageOverview('month'),
      // 월말 예측
      getForecast(),
      // 캐시 비용 비교
      getCacheCostComparison('month'),
      // 이상 징후 감지
      detectAnomalies(2.0),
    ]);

    const stats: SystemStats = {
      totalTenants: tenantStats[0]?.total ?? 0,
      activeTenants: tenantStats[0]?.active ?? 0,
      totalDocuments: documentCount[0]?.count ?? 0,
      totalChunks: chunkStats[0]?.total ?? 0,
      approvedChunks: chunkStats[0]?.approved ?? 0,
      totalConversations: conversationStats[0]?.total ?? 0,
      todayConversations: conversationStats[0]?.today ?? 0,
      weeklyConversations: conversationStats[0]?.weekly ?? 0,
    };

    const topTenants: TenantUsage[] = (topTenantsData.rows as Array<{
      id: string;
      name: string | null;
      email: string;
      status: string | null;
      document_count: string;
      chunk_count: string;
      conversation_count: string;
      created_at: Date | string;
    }>).map((row) => ({
      id: row.id,
      name: row.name || row.email.split('@')[0],
      email: row.email,
      status: row.status || 'active',
      documentCount: parseInt(row.document_count) || 0,
      chunkCount: parseInt(row.chunk_count) || 0,
      conversationCount: parseInt(row.conversation_count) || 0,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : (row.created_at ? String(row.created_at) : new Date().toISOString()),
    }));

    // 캐시 히트율 계산
    const totalCacheRequests = cacheCost.cachedRequests + cacheCost.nonCachedRequests;
    const cacheHitRate = totalCacheRequests > 0
      ? (cacheCost.cachedRequests / totalCacheRequests) * 100
      : 0;

    // AI 사용량 요약 생성
    const aiUsage: AIUsageSummary = {
      todayCostUsd: todayUsage.totalCostUsd,
      todayTokens: todayUsage.totalTokens,
      monthCostUsd: monthUsage.totalCostUsd,
      monthTokens: monthUsage.totalTokens,
      forecastCostUsd: forecast.projectedMonthlyUsage,
      cacheHitRate,
      estimatedSavings: cacheCost.estimatedSavings,
      anomalyCount: anomaliesRaw.length,
    };

    // 이상 징후 테넌트 이름 조회
    const anomalyTenantIds = anomaliesRaw.map((a) => a.tenantId);
    const anomalyTenantNames = new Map<string, string>();
    if (anomalyTenantIds.length > 0) {
      const tenantRecords = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants);
      for (const t of tenantRecords) {
        anomalyTenantNames.set(t.id, t.name);
      }
    }

    const anomalies = anomaliesRaw.slice(0, 5).map((a) => ({
      tenantId: a.tenantId,
      tenantName: anomalyTenantNames.get(a.tenantId) || 'Unknown',
      todayCost: a.todayCost,
      increaseRatio: a.increaseRatio,
    }));

    logger.info('Admin dashboard data fetched', {
      operatorId: session.userId,
      stats: {
        tenants: stats.totalTenants,
        documents: stats.totalDocuments,
        conversations: stats.totalConversations,
      },
      aiUsage: {
        todayCost: aiUsage.todayCostUsd,
        anomalyCount: aiUsage.anomalyCount,
      },
    });

    return {
      stats,
      topTenants,
      aiUsage,
      anomalies,
      recentErrors: [], // 에러 로그 테이블이 있다면 여기서 조회
    };
  } catch (error) {
    logger.error('Failed to fetch admin dashboard data', error as Error);
    return null;
  }
}

/**
 * 테넌트 상세 정보 조회
 */
export async function getTenantDetails(tenantId: string): Promise<TenantUsage | null> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const result = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        t.email,
        t.status,
        COALESCE(d.doc_count, 0) as document_count,
        COALESCE(c.chunk_count, 0) as chunk_count,
        COALESCE(cv.conv_count, 0) as conversation_count,
        t.created_at
      FROM tenants t
      LEFT JOIN (
        SELECT tenant_id, count(*) as doc_count
        FROM documents
        GROUP BY tenant_id
      ) d ON d.tenant_id = t.id
      LEFT JOIN (
        SELECT documents.tenant_id, count(*) as chunk_count
        FROM chunks
        JOIN documents ON chunks.document_id = documents.id
        GROUP BY documents.tenant_id
      ) c ON c.tenant_id = t.id
      LEFT JOIN (
        SELECT tenant_id, count(*) as conv_count
        FROM conversations
        GROUP BY tenant_id
      ) cv ON cv.tenant_id = t.id
      WHERE t.id = ${tenantId}
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as {
      id: string;
      name: string | null;
      email: string;
      status: string | null;
      document_count: string;
      chunk_count: string;
      conversation_count: string;
      created_at: Date | string;
    };

    return {
      id: row.id,
      name: row.name || row.email.split('@')[0],
      email: row.email,
      status: row.status || 'active',
      documentCount: parseInt(row.document_count) || 0,
      chunkCount: parseInt(row.chunk_count) || 0,
      conversationCount: parseInt(row.conversation_count) || 0,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : (row.created_at ? String(row.created_at) : new Date().toISOString()),
    };
  } catch (error) {
    logger.error('Failed to fetch tenant details', error as Error, { tenantId });
    return null;
  }
}
