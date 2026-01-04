/**
 * 포인트 서비스
 *
 * 포인트 충전, 차감, 조회 등 핵심 비즈니스 로직을 담당합니다.
 * 모든 포인트 관련 작업은 이 서비스를 통해 수행됩니다.
 */

import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  tenantPoints,
  pointTransactions,
  type TenantPoint,
  type PointTransaction,
} from '@/drizzle/schema';
import {
  FREE_TRIAL_POINTS,
  POINTS_PER_RESPONSE,
  POINT_TRANSACTION_TYPES,
  LOW_POINTS_THRESHOLD,
  type PointTransactionType,
} from './constants';

// ============================================
// 타입 정의
// ============================================

export interface ChargePointsParams {
  tenantId: string;
  amount: number;
  type: PointTransactionType;
  description?: string;
  metadata?: {
    chatbotId?: string;
    conversationId?: string;
    paymentId?: string;
    packageId?: string;
    subscriptionId?: string;
    channel?: string;
    reason?: string;
  };
}

export interface UsePointsParams {
  tenantId: string;
  amount?: number; // 기본값: POINTS_PER_RESPONSE (1)
  metadata: {
    chatbotId?: string;      // 챗봇 ID (특정 챗봇 사용 시)
    conversationId?: string; // 대화 세션 ID
    sessionId?: string;      // 레거시 호환용 (conversationId와 동일)
    channel?: string;        // 채널 (web, kakao 등)
  };
}

export interface PointBalanceInfo {
  balance: number;
  freePointsGranted: boolean;
  monthlyPointsBase: number;
  lastRechargedAt: Date | null;
  isLow: boolean; // LOW_POINTS_THRESHOLD 이하 여부
}

export interface PointTransactionInfo {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string | null;
  metadata: PointTransaction['metadata'];
  createdAt: Date | null;
}

// ============================================
// 포인트 조회
// ============================================

/**
 * 테넌트의 현재 포인트 잔액 조회
 */
export async function getPointBalance(tenantId: string): Promise<number> {
  const [record] = await db
    .select({ balance: tenantPoints.balance })
    .from(tenantPoints)
    .where(eq(tenantPoints.tenantId, tenantId));

  return record?.balance ?? 0;
}

/**
 * 테넌트의 포인트 상세 정보 조회
 */
export async function getPointBalanceInfo(
  tenantId: string
): Promise<PointBalanceInfo> {
  const [record] = await db
    .select()
    .from(tenantPoints)
    .where(eq(tenantPoints.tenantId, tenantId));

  if (!record) {
    return {
      balance: 0,
      freePointsGranted: false,
      monthlyPointsBase: 0,
      lastRechargedAt: null,
      isLow: true,
    };
  }

  return {
    balance: record.balance,
    freePointsGranted: record.freePointsGranted ?? false,
    monthlyPointsBase: record.monthlyPointsBase ?? 0,
    lastRechargedAt: record.lastRechargedAt,
    isLow: record.balance <= LOW_POINTS_THRESHOLD,
  };
}

/**
 * 포인트가 충분한지 확인
 */
export async function hasEnoughPoints(
  tenantId: string,
  required: number = POINTS_PER_RESPONSE
): Promise<boolean> {
  const balance = await getPointBalance(tenantId);
  return balance >= required;
}

// ============================================
// 포인트 충전
// ============================================

/**
 * 테넌트 포인트 레코드 초기화 (없으면 생성)
 */
async function ensurePointRecord(tenantId: string): Promise<TenantPoint> {
  const [existing] = await db
    .select()
    .from(tenantPoints)
    .where(eq(tenantPoints.tenantId, tenantId));

  if (existing) {
    return existing;
  }

  // 새 레코드 생성
  const [created] = await db
    .insert(tenantPoints)
    .values({
      tenantId,
      balance: 0,
      freePointsGranted: false,
      monthlyPointsBase: 0,
    })
    .returning();

  return created;
}

/**
 * 포인트 충전 (일반)
 *
 * 월간 충전, 패키지 구매, 관리자 조정 등에 사용
 */
export async function chargePoints({
  tenantId,
  amount,
  type,
  description,
  metadata,
}: ChargePointsParams): Promise<{ newBalance: number; transactionId: string }> {
  if (amount <= 0) {
    throw new Error('충전 금액은 양수여야 합니다');
  }

  // 레코드 확보
  await ensurePointRecord(tenantId);

  // 원자적 업데이트 + 트랜잭션 기록
  // Neon HTTP는 트랜잭션 미지원이므로 순차 실행
  const [updated] = await db
    .update(tenantPoints)
    .set({
      balance: sql`${tenantPoints.balance} + ${amount}`,
      updatedAt: new Date(),
      ...(type === POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE && {
        monthlyPointsBase: amount,
        lastRechargedAt: new Date(),
      }),
    })
    .where(eq(tenantPoints.tenantId, tenantId))
    .returning();

  // 거래 이력 기록
  const [transaction] = await db
    .insert(pointTransactions)
    .values({
      tenantId,
      type,
      amount: amount, // 양수
      balance: updated.balance,
      description: description ?? getDefaultDescription(type),
      metadata,
    })
    .returning();

  return {
    newBalance: updated.balance,
    transactionId: transaction.id,
  };
}

/**
 * 체험 포인트 지급 (1회성)
 *
 * 신규 가입 시 자동 호출
 */
export async function grantFreeTrialPoints(
  tenantId: string
): Promise<{ granted: boolean; balance: number }> {
  const record = await ensurePointRecord(tenantId);

  // 이미 지급된 경우
  if (record.freePointsGranted) {
    return { granted: false, balance: record.balance };
  }

  // 체험 포인트 지급
  const [updated] = await db
    .update(tenantPoints)
    .set({
      balance: sql`${tenantPoints.balance} + ${FREE_TRIAL_POINTS}`,
      freePointsGranted: true,
      updatedAt: new Date(),
    })
    .where(eq(tenantPoints.tenantId, tenantId))
    .returning();

  // 거래 이력 기록
  await db.insert(pointTransactions).values({
    tenantId,
    type: POINT_TRANSACTION_TYPES.FREE_TRIAL,
    amount: FREE_TRIAL_POINTS,
    balance: updated.balance,
    description: '체험 포인트 지급 (신규 가입)',
    metadata: { reason: 'new_signup' },
  });

  return { granted: true, balance: updated.balance };
}

// ============================================
// 포인트 사용 (차감)
// ============================================

/**
 * AI 응답에 대한 포인트 차감
 *
 * @throws Error 포인트 부족 시
 */
export async function usePoints({
  tenantId,
  amount = POINTS_PER_RESPONSE,
  metadata,
}: UsePointsParams): Promise<{ newBalance: number; transactionId: string }> {
  if (amount <= 0) {
    throw new Error('사용 포인트는 양수여야 합니다');
  }

  // 현재 잔액 확인
  const currentBalance = await getPointBalance(tenantId);

  if (currentBalance < amount) {
    throw new Error('포인트가 부족합니다');
  }

  // 원자적 차감 (음수 방지)
  const [updated] = await db
    .update(tenantPoints)
    .set({
      balance: sql`GREATEST(${tenantPoints.balance} - ${amount}, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantPoints.tenantId, tenantId),
        sql`${tenantPoints.balance} >= ${amount}`
      )
    )
    .returning();

  // 동시성 문제로 업데이트 실패 시
  if (!updated) {
    throw new Error('포인트 차감 중 오류가 발생했습니다');
  }

  // 거래 이력 기록
  const [transaction] = await db
    .insert(pointTransactions)
    .values({
      tenantId,
      type: POINT_TRANSACTION_TYPES.AI_RESPONSE,
      amount: -amount, // 음수
      balance: updated.balance,
      description: 'AI 응답',
      metadata: {
        chatbotId: metadata.chatbotId,
        // sessionId와 conversationId 통합 (레거시 호환)
        conversationId: metadata.conversationId ?? metadata.sessionId,
        channel: metadata.channel,
      },
    })
    .returning();

  return {
    newBalance: updated.balance,
    transactionId: transaction.id,
  };
}

/**
 * 포인트 환불
 *
 * 결제 취소, 오류 보상 등에 사용
 */
export async function refundPoints({
  tenantId,
  amount,
  description,
  metadata,
}: ChargePointsParams): Promise<{ newBalance: number; transactionId: string }> {
  return chargePoints({
    tenantId,
    amount,
    type: POINT_TRANSACTION_TYPES.REFUND,
    description: description ?? '포인트 환불',
    metadata,
  });
}

// ============================================
// 거래 이력 조회
// ============================================

/**
 * 포인트 거래 이력 조회
 */
export async function getPointTransactions(
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    fromDate?: Date;
  } = {}
): Promise<PointTransactionInfo[]> {
  const { limit = 20, offset = 0, fromDate } = options;

  let query = db
    .select()
    .from(pointTransactions)
    .where(
      fromDate
        ? and(
            eq(pointTransactions.tenantId, tenantId),
            gte(pointTransactions.createdAt, fromDate)
          )
        : eq(pointTransactions.tenantId, tenantId)
    )
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  const transactions = await query;

  return transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    balance: tx.balance,
    description: tx.description,
    metadata: tx.metadata,
    createdAt: tx.createdAt,
  }));
}

/**
 * 이번 달 포인트 사용량 조회
 */
export async function getMonthlyUsage(tenantId: string): Promise<{
  used: number;
  transactionCount: number;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalUsed: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.tenantId, tenantId),
        eq(pointTransactions.type, POINT_TRANSACTION_TYPES.AI_RESPONSE),
        gte(pointTransactions.createdAt, startOfMonth)
      )
    );

  return {
    used: result[0]?.totalUsed ?? 0,
    transactionCount: result[0]?.count ?? 0,
  };
}

// ============================================
// 유틸리티
// ============================================

/**
 * 트랜잭션 타입별 기본 설명
 */
function getDefaultDescription(type: PointTransactionType): string {
  switch (type) {
    case POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE:
      return '월간 포인트 충전';
    case POINT_TRANSACTION_TYPES.PURCHASE:
      return '포인트 추가 구매';
    case POINT_TRANSACTION_TYPES.AI_RESPONSE:
      return 'AI 응답';
    case POINT_TRANSACTION_TYPES.FREE_TRIAL:
      return '체험 포인트 지급';
    case POINT_TRANSACTION_TYPES.REFUND:
      return '포인트 환불';
    case POINT_TRANSACTION_TYPES.ADMIN_ADJUSTMENT:
      return '관리자 조정';
    case POINT_TRANSACTION_TYPES.EXPIRE:
      return '포인트 만료';
    default:
      return '포인트 변동';
  }
}
