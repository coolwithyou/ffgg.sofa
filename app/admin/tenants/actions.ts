'use server';

/**
 * 테넌트 관리 서버 액션
 * [Week 10] 테넌트 목록 및 상세 관리
 */

import { validateSession } from '@/lib/auth';
import { db, tenants, documents, chunks, conversations } from '@/lib/db';
import { sql, eq, desc, count } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// UUID 검증 스키마
const uuidSchema = z.string().uuid('유효한 UUID 형식이 아닙니다.');

export interface TenantListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  tier: string;
  documentCount: number;
  chunkCount: number;
  conversationCount: number;
  createdAt: string;
}

export interface TenantDetail extends TenantListItem {
  settings: Record<string, unknown>;
  usageLog: Array<{
    date: string;
    conversations: number;
    tokens: number;
  }>;
}

/**
 * 테넌트 목록 조회
 */
export async function getTenantList(): Promise<TenantListItem[]> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return [];
  }

  try {
    const result = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        t.email,
        t.status,
        t.tier,
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
      ORDER BY t.created_at DESC
    `);

    return (result as unknown as Array<{
      id: string;
      name: string | null;
      email: string;
      status: string | null;
      tier: string | null;
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
      documentCount: parseInt(row.document_count) || 0,
      chunkCount: parseInt(row.chunk_count) || 0,
      conversationCount: parseInt(row.conversation_count) || 0,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : (row.created_at ? String(row.created_at) : new Date().toISOString()),
    }));
  } catch (error) {
    logger.error('Failed to fetch tenant list', error as Error);
    return [];
  }
}

/**
 * 테넌트 상태 변경
 */
export async function updateTenantStatus(
  tenantId: string,
  status: 'active' | 'inactive' | 'suspended'
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return { success: false, error: '권한이 없습니다.' };
  }

  // UUID 형식 검증
  const parseResult = uuidSchema.safeParse(tenantId);
  if (!parseResult.success) {
    return { success: false, error: '유효하지 않은 테넌트 ID입니다.' };
  }

  try {
    await db
      .update(tenants)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    revalidatePath('/admin/tenants');

    logger.info('Tenant status updated', {
      tenantId,
      newStatus: status,
      operatorId: session.userId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update tenant status', error as Error, { tenantId });
    return { success: false, error: '상태 변경에 실패했습니다.' };
  }
}

/**
 * 테넌트 티어 변경
 */
export async function updateTenantTier(
  tenantId: string,
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return { success: false, error: '권한이 없습니다.' };
  }

  // UUID 형식 검증
  const parseResult = uuidSchema.safeParse(tenantId);
  if (!parseResult.success) {
    return { success: false, error: '유효하지 않은 테넌트 ID입니다.' };
  }

  try {
    await db
      .update(tenants)
      .set({
        tier,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    revalidatePath('/admin/tenants');

    logger.info('Tenant tier updated', {
      tenantId,
      newTier: tier,
      operatorId: session.userId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update tenant tier', error as Error, { tenantId });
    return { success: false, error: '티어 변경에 실패했습니다.' };
  }
}

/**
 * 테넌트 사용량 통계 조회 (최근 30일)
 */
export async function getTenantUsageStats(tenantId: string): Promise<
  Array<{
    date: string;
    conversations: number;
  }>
> {
  const session = await validateSession();

  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return [];
  }

  // UUID 형식 검증
  const parseResult = uuidSchema.safeParse(tenantId);
  if (!parseResult.success) {
    return [];
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.execute(sql`
      SELECT
        DATE(created_at) as date,
        count(*) as conversations
      FROM conversations
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${thirtyDaysAgo.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    return (result as unknown as Array<{
      date: Date;
      conversations: string;
    }>).map((row) => ({
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date),
      conversations: parseInt(row.conversations) || 0,
    }));
  } catch (error) {
    logger.error('Failed to fetch tenant usage stats', error as Error, { tenantId });
    return [];
  }
}
