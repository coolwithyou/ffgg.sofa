'use server';

/**
 * 대시보드 서버 액션
 * [Week 9] 대시보드 데이터 조회
 */

import { validateSession } from '@/lib/auth';
import { db, documents, chunks, conversations } from '@/lib/db';
import { eq, sql, desc, and, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface DashboardStats {
  totalDocuments: number;
  approvedChunks: number;
  pendingChunks: number;
  totalConversations: number;
  recentConversations: number; // 최근 7일
}

export interface RecentDocument {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface RecentConversation {
  id: string;
  sessionId: string;
  channel: string;
  createdAt: string;
}

export interface ProcessingDocument {
  id: string;
  filename: string;
  status: 'processing' | 'uploaded';
  progressStep: string | null;
  progressPercent: number | null;
  createdAt: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentDocuments: RecentDocument[];
  recentConversations: RecentConversation[];
  processingDocuments: ProcessingDocument[];
}

/**
 * 대시보드 데이터 조회
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const session = await validateSession();

  if (!session) {
    return null;
  }

  const tenantId = session.tenantId;

  try {
    // 병렬로 모든 데이터 조회
    const [
      documentStats,
      chunkStats,
      conversationStats,
      recentDocs,
      recentConversationsData,
      processingDocsData,
    ] = await Promise.all([
      // 문서 통계
      db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(eq(documents.tenantId, tenantId)),

      // 청크 통계
      db
        .select({
          status: chunks.status,
          count: sql<number>`count(*)`,
        })
        .from(chunks)
        .innerJoin(documents, eq(chunks.documentId, documents.id))
        .where(eq(documents.tenantId, tenantId))
        .groupBy(chunks.status),

      // 대화 통계
      db
        .select({
          total: sql<number>`count(*)`,
          recent: sql<number>`count(*) filter (where ${conversations.createdAt} >= now() - interval '7 days')`,
        })
        .from(conversations)
        .where(eq(conversations.tenantId, tenantId)),

      // 최근 문서
      db
        .select({
          id: documents.id,
          filename: documents.filename,
          status: documents.status,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(eq(documents.tenantId, tenantId))
        .orderBy(desc(documents.createdAt))
        .limit(5),

      // 최근 대화
      db
        .select({
          id: conversations.id,
          sessionId: conversations.sessionId,
          channel: conversations.channel,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .where(eq(conversations.tenantId, tenantId))
        .orderBy(desc(conversations.createdAt))
        .limit(5),

      // 처리 중인 문서
      db
        .select({
          id: documents.id,
          filename: documents.filename,
          status: documents.status,
          progressStep: documents.progressStep,
          progressPercent: documents.progressPercent,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            inArray(documents.status, ['processing', 'uploaded'])
          )
        )
        .orderBy(desc(documents.createdAt))
        .limit(5),
    ]);

    // 청크 통계 집계
    const approvedChunks = chunkStats.find((s) => s.status === 'approved')?.count || 0;
    const pendingChunks = chunkStats.find((s) => s.status === 'pending')?.count || 0;

    return {
      stats: {
        totalDocuments: documentStats[0]?.count || 0,
        approvedChunks,
        pendingChunks,
        totalConversations: conversationStats[0]?.total || 0,
        recentConversations: conversationStats[0]?.recent || 0,
      },
      recentDocuments: recentDocs.map((d) => ({
        id: d.id,
        title: d.filename,
        status: d.status || 'uploaded',
        createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
      })),
      recentConversations: recentConversationsData.map((c) => ({
        id: c.id,
        sessionId: c.sessionId.slice(0, 12) + '...',
        channel: c.channel || 'web',
        createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
      })),
      processingDocuments: processingDocsData.map((d) => ({
        id: d.id,
        filename: d.filename,
        status: d.status as 'processing' | 'uploaded',
        progressStep: d.progressStep,
        progressPercent: d.progressPercent,
        createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
      })),
    };
  } catch (error) {
    logger.error('Failed to get dashboard data', error as Error, { tenantId });
    return null;
  }
}
