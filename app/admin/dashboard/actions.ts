'use server';

/**
 * 관리자 대시보드 서버 액션
 * [Week 10] 전체 시스템 현황 조회
 */

import { validateSession } from '@/lib/auth';
import { db, tenants, documents, chunks, conversations } from '@/lib/db';
import { tenantPoints, pointTransactions } from '@/drizzle/schema';
import { sql, count, eq, gte, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import {
  getUsageOverview,
  getForecast,
  getCacheCostComparison,
  detectAnomalies,
} from '@/lib/usage/cost-calculator';
import type { UsageOverview, Forecast, CacheCostComparison } from '@/lib/usage/types';
import { LOW_POINTS_THRESHOLD, POINT_TRANSACTION_TYPES } from '@/lib/points/constants';

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
  tier: string;                  // 🆕 테넌트 플랜 티어
  balance: number;               // 🆕 포인트 잔액
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

// 포인트 시스템 통계
export interface PointsStats {
  totalBalance: number;           // 전체 테넌트 포인트 잔액 합계
  activeTenantsWithPoints: number; // 포인트를 보유한 활성 테넌트 수
  lowBalanceCount: number;        // 저잔액 테넌트 수 (100P 이하)
  todayUsage: number;             // 오늘 사용된 포인트
  monthUsage: number;             // 이번 달 사용된 포인트
  todayCharges: number;           // 오늘 충전된 포인트
  monthCharges: number;           // 이번 달 충전된 포인트
}

export interface AdminDashboardData {
  stats: SystemStats;
  topTenants: TenantUsage[];
  aiUsage: AIUsageSummary;
  pointsStats: PointsStats;
  anomalies: Array<{
    tenantId: string;
    tenantName: string;
    todayCost: number;
    increaseRatio: number;
  }>;
  lowBalanceTenants: Array<{
    tenantId: string;
    tenantName: string;
    tier: string;
    balance: number;
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
/**
 * 타임아웃이 있는 프로미스 래퍼
 * 지정된 시간 내에 완료되지 않으면 기본값 반환
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  defaultValue: T
): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(defaultValue);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(defaultValue);
      });
  });
}

// AI 사용량 기본값 (쿼리 실패/타임아웃 시 사용)
const DEFAULT_USAGE_OVERVIEW: UsageOverview = {
  period: 'today',
  totalTokens: 0,
  totalCostUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  byModel: [],
  byFeature: [],
};

const DEFAULT_FORECAST: Forecast = {
  currentMonthUsage: 0,
  projectedMonthlyUsage: 0,
  daysRemaining: 0,
  dailyAverage: 0,
  trend: 'stable',
  confidenceLevel: 'low',
};

const DEFAULT_CACHE_COST: CacheCostComparison = {
  cachedRequests: 0,
  nonCachedRequests: 0,
  estimatedSavings: 0,
};

export async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // AI 사용량 쿼리 타임아웃 (3초) - 느린 쿼리가 페이지 로딩을 블록하지 않도록
    const AI_QUERY_TIMEOUT_MS = 3000;

    // ========================================
    // 배치 1: 핵심 통계 + AI 사용량 (10개 쿼리)
    // 커넥션 풀 고갈 방지를 위해 배치 분할
    // ========================================
    const [
      tenantStats,
      documentCount,
      chunkStats,
      conversationStats,
      topTenantsData,
      // AI 사용량 데이터 (타임아웃 적용)
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

      // 상위 테넌트 (사용량 기준) - 티어 및 포인트 잔액 포함
      db.execute(sql`
        SELECT
          t.id,
          t.name,
          t.email,
          t.status,
          t.tier,
          COALESCE(tp.balance, 0) as balance,
          COALESCE(d.doc_count, 0) as document_count,
          COALESCE(c.chunk_count, 0) as chunk_count,
          COALESCE(cv.conv_count, 0) as conversation_count,
          t.created_at
        FROM tenants t
        LEFT JOIN tenant_points tp ON tp.tenant_id = t.id
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
        ORDER BY COALESCE(cv.conv_count, 0) DESC
        LIMIT 10
      `),

      // AI 사용량: 오늘 (타임아웃 3초)
      withTimeout(getUsageOverview('today'), AI_QUERY_TIMEOUT_MS, DEFAULT_USAGE_OVERVIEW),
      // AI 사용량: 이번 달 (타임아웃 3초)
      withTimeout(
        getUsageOverview('month'),
        AI_QUERY_TIMEOUT_MS,
        { ...DEFAULT_USAGE_OVERVIEW, period: 'month' as const }
      ),
      // 월말 예측 (타임아웃 3초)
      withTimeout(getForecast(), AI_QUERY_TIMEOUT_MS, DEFAULT_FORECAST),
      // 캐시 비용 비교 (타임아웃 3초)
      withTimeout(getCacheCostComparison('month'), AI_QUERY_TIMEOUT_MS, DEFAULT_CACHE_COST),
      // 이상 징후 감지 (타임아웃 3초)
      withTimeout(detectAnomalies(2.0), AI_QUERY_TIMEOUT_MS, []),
    ]);

    // ========================================
    // 배치 2: 포인트 통계 (6개 쿼리)
    // 배치 1 완료 후 순차 실행
    // ========================================
    const [
      pointsOverview,
      todayPointUsage,
      monthPointUsage,
      todayPointCharges,
      monthPointCharges,
      lowBalanceTenantsData,
    ] = await Promise.all([
      // 포인트 통계: 전체 잔액 및 테넌트 수
      db
        .select({
          totalBalance: sql<number>`COALESCE(SUM(balance), 0)`,
          activeCount: sql<number>`COUNT(*) FILTER (WHERE balance > 0)`,
          lowBalanceCount: sql<number>`COUNT(*) FILTER (WHERE balance <= ${LOW_POINTS_THRESHOLD} AND balance >= 0)`,
        })
        .from(tenantPoints),

      // 포인트 통계: 오늘 사용량 (음수 트랜잭션)
      db
        .select({
          total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
        })
        .from(pointTransactions)
        .where(
          and(
            eq(pointTransactions.type, POINT_TRANSACTION_TYPES.AI_RESPONSE),
            gte(pointTransactions.createdAt, todayStart)
          )
        ),

      // 포인트 통계: 이번 달 사용량
      db
        .select({
          total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
        })
        .from(pointTransactions)
        .where(
          and(
            eq(pointTransactions.type, POINT_TRANSACTION_TYPES.AI_RESPONSE),
            gte(pointTransactions.createdAt, monthStart)
          )
        ),

      // 포인트 통계: 오늘 충전량
      db
        .select({
          total: sql<number>`COALESCE(SUM(amount), 0)`,
        })
        .from(pointTransactions)
        .where(
          and(
            sql`${pointTransactions.type} IN (${POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE}, ${POINT_TRANSACTION_TYPES.PURCHASE}, ${POINT_TRANSACTION_TYPES.FREE_TRIAL})`,
            gte(pointTransactions.createdAt, todayStart)
          )
        ),

      // 포인트 통계: 이번 달 충전량
      db
        .select({
          total: sql<number>`COALESCE(SUM(amount), 0)`,
        })
        .from(pointTransactions)
        .where(
          and(
            sql`${pointTransactions.type} IN (${POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE}, ${POINT_TRANSACTION_TYPES.PURCHASE}, ${POINT_TRANSACTION_TYPES.FREE_TRIAL})`,
            gte(pointTransactions.createdAt, monthStart)
          )
        ),

      // 저잔액 테넌트 목록
      db.execute(sql`
        SELECT
          tp.tenant_id,
          t.name as tenant_name,
          t.tier,
          tp.balance
        FROM tenant_points tp
        JOIN tenants t ON t.id = tp.tenant_id
        WHERE tp.balance <= ${LOW_POINTS_THRESHOLD}
          AND t.status = 'active'
        ORDER BY tp.balance ASC
        LIMIT 10
      `),
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

    const topTenants: TenantUsage[] = (topTenantsData as unknown as Array<{
      id: string;
      name: string | null;
      email: string;
      status: string | null;
      tier: string | null;
      balance: number | string;
      document_count: string;
      chunk_count: string;
      conversation_count: string;
      created_at: Date | string;
    }>).map((row) => ({
      id: row.id,
      name: row.name || row.email.split('@')[0],
      email: row.email,
      status: row.status || 'active',
      tier: row.tier || 'free',
      balance: typeof row.balance === 'number' ? row.balance : parseInt(String(row.balance)) || 0,
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

    // 포인트 통계 생성
    const pointsStats: PointsStats = {
      totalBalance: pointsOverview[0]?.totalBalance ?? 0,
      activeTenantsWithPoints: pointsOverview[0]?.activeCount ?? 0,
      lowBalanceCount: pointsOverview[0]?.lowBalanceCount ?? 0,
      todayUsage: todayPointUsage[0]?.total ?? 0,
      monthUsage: monthPointUsage[0]?.total ?? 0,
      todayCharges: todayPointCharges[0]?.total ?? 0,
      monthCharges: monthPointCharges[0]?.total ?? 0,
    };

    // 저잔액 테넌트 목록 처리
    const lowBalanceTenants = (lowBalanceTenantsData as unknown as Array<{
      tenant_id: string;
      tenant_name: string | null;
      tier: string | null;
      balance: number;
    }>).map((row) => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name || 'Unknown',
      tier: row.tier || 'free',
      balance: row.balance,
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
      pointsStats,
      anomalies,
      lowBalanceTenants,
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
        t.tier,
        COALESCE(tp.balance, 0) as balance,
        COALESCE(d.doc_count, 0) as document_count,
        COALESCE(c.chunk_count, 0) as chunk_count,
        COALESCE(cv.conv_count, 0) as conversation_count,
        t.created_at
      FROM tenants t
      LEFT JOIN tenant_points tp ON tp.tenant_id = t.id
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

    if (result.length === 0) {
      return null;
    }

    const row = result[0] as {
      id: string;
      name: string | null;
      email: string;
      status: string | null;
      tier: string | null;
      balance: number | string;
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
      tier: row.tier || 'free',
      balance: typeof row.balance === 'number' ? row.balance : parseInt(String(row.balance)) || 0,
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
