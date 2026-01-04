/**
 * 포인트 조회 API
 *
 * GET /api/points - 현재 포인트 잔액 및 상세 정보 조회
 * GET /api/points?includeTransactions=true&limit=20 - 거래 내역 포함 조회
 *
 * @returns 포인트 잔액, 월간 사용량, 거래 내역 (옵션)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { AppError, ErrorCode, errorResponse } from '@/lib/errors';
import {
  getPointBalanceInfo,
  getPointTransactions,
  getMonthlyUsage,
  type PointBalanceInfo,
  type PointTransactionInfo,
} from '@/lib/points';

export interface PointsResponse {
  /** 포인트 잔액 정보 */
  balance: PointBalanceInfo;
  /** 이번 달 사용량 */
  monthlyUsage: {
    used: number;
    transactionCount: number;
  };
  /** 거래 내역 (includeTransactions=true일 때만) */
  transactions?: PointTransactionInfo[];
}

export async function GET(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    const { tenantId } = session;

    // 2. URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const includeTransactions = searchParams.get('includeTransactions') === 'true';
    const transactionLimit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100 // 최대 100개로 제한
    );

    // 3. 포인트 정보 조회 (병렬)
    const [balanceInfo, monthlyUsage] = await Promise.all([
      getPointBalanceInfo(tenantId),
      getMonthlyUsage(tenantId),
    ]);

    // 4. 거래 내역 조회 (옵션)
    let transactions: PointTransactionInfo[] | undefined;
    if (includeTransactions) {
      transactions = await getPointTransactions(tenantId, {
        limit: transactionLimit,
      });
    }

    const response: PointsResponse = {
      balance: balanceInfo,
      monthlyUsage,
      ...(transactions && { transactions }),
    };

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
