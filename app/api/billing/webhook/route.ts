/**
 * PortOne 웹훅 엔드포인트
 * [Billing System] PortOne에서 발생하는 결제 이벤트 처리
 *
 * POST /api/billing/webhook
 *
 * @see https://developers.portone.io/opi/ko/integration/webhook/readme
 *
 * 지원 이벤트:
 * - Transaction.Paid: 결제 완료
 * - Transaction.Failed: 결제 실패
 * - Transaction.Cancelled: 결제 취소
 * - Transaction.PartialCancelled: 부분 취소
 * - BillingKey.Deleted: 빌링키 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingWebhookLogs, payments, subscriptions, tenants } from '@/drizzle/schema';
import {
  verifyWebhook,
  sanitizeWebhookPayload,
  extractTransactionData,
  type WebhookEventType,
} from '@/lib/portone/webhook';
import { logger } from '@/lib/logger';

// 웹훅 검증 실패 시 응답
function unauthorized(message: string) {
  logger.warn('Webhook verification failed', { message });
  return new NextResponse(message, { status: 401 });
}

export async function POST(request: NextRequest) {
  let webhookLogId: string | null = null;

  try {
    // 1. 원본 body 추출 (서명 검증용)
    const body = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // 2. 웹훅 서명 검증
    let webhookData: Awaited<ReturnType<typeof verifyWebhook>>;
    try {
      webhookData = await verifyWebhook(body, headers);
    } catch (error) {
      return unauthorized('Invalid webhook signature');
    }

    // 3. 페이로드 파싱 및 마스킹 (PIPA 준수)
    const rawPayload = JSON.parse(body) as Record<string, unknown>;
    const sanitizedPayload = sanitizeWebhookPayload(rawPayload);

    // 4. 웹훅 로그 저장 (처리 전)
    const [webhookLog] = await db
      .insert(billingWebhookLogs)
      .values({
        webhookId: (rawPayload.webhookId as string) || null,
        eventType: (rawPayload.type as string) || 'unknown',
        payload: sanitizedPayload, // 마스킹된 페이로드 저장
        processed: false,
      })
      .returning();

    webhookLogId = webhookLog.id;

    // 5. 이벤트 타입별 처리
    const eventType = rawPayload.type as WebhookEventType;

    logger.info('Webhook received', {
      webhookLogId,
      eventType,
      webhookId: rawPayload.webhookId,
    });

    switch (eventType) {
      case 'Transaction.Paid':
        await handleTransactionPaid(rawPayload);
        break;

      case 'Transaction.Failed':
        await handleTransactionFailed(rawPayload);
        break;

      case 'Transaction.Cancelled':
      case 'Transaction.PartialCancelled':
        await handleTransactionCancelled(rawPayload, eventType);
        break;

      case 'BillingKey.Deleted':
        await handleBillingKeyDeleted(rawPayload);
        break;

      default:
        logger.info('Unhandled webhook event type', { eventType });
    }

    // 6. 웹훅 처리 완료 표시
    await db
      .update(billingWebhookLogs)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(billingWebhookLogs.id, webhookLogId));

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);

    // 에러 정보 로그에 기록
    if (webhookLogId) {
      await db
        .update(billingWebhookLogs)
        .set({
          error: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date(),
        })
        .where(eq(billingWebhookLogs.id, webhookLogId));
    }

    // 웹훅은 200을 반환해야 재시도하지 않음
    // 단, 검증 실패는 401 반환
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

/**
 * 결제 완료 처리
 */
async function handleTransactionPaid(payload: Record<string, unknown>) {
  const transactionData = extractTransactionData(payload);
  if (!transactionData?.paymentId) {
    logger.warn('Transaction.Paid: Missing paymentId', { payload });
    return;
  }

  const { paymentId, transactionId, amount, method, receiptUrl, paidAt } = transactionData;

  // 결제 내역 업데이트
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);

  if (existingPayment) {
    await db
      .update(payments)
      .set({
        status: 'PAID',
        transactionId,
        amount: amount?.total ?? existingPayment.amount,
        payMethod: method?.type,
        cardInfo: method?.card
          ? {
              issuer: method.card.issuer,
              acquirer: method.card.acquirer,
              number: method.card.number,
              type: method.card.type,
            }
          : undefined,
        receiptUrl,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existingPayment.id));

    logger.info('Payment marked as paid', {
      paymentId,
      transactionId,
      amount: amount?.total,
    });
  } else {
    logger.warn('Transaction.Paid: Payment record not found', { paymentId });
  }
}

/**
 * 결제 실패 처리
 */
async function handleTransactionFailed(payload: Record<string, unknown>) {
  const transactionData = extractTransactionData(payload);
  if (!transactionData?.paymentId) {
    logger.warn('Transaction.Failed: Missing paymentId', { payload });
    return;
  }

  const { paymentId, failReason } = transactionData;

  // 결제 내역 업데이트
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);

  if (existingPayment) {
    await db
      .update(payments)
      .set({
        status: 'FAILED',
        failReason,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existingPayment.id));

    // 구독 상태 업데이트 (결제 실패)
    if (existingPayment.subscriptionId) {
      await db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingPayment.subscriptionId));
    }

    logger.info('Payment marked as failed', {
      paymentId,
      failReason,
      subscriptionId: existingPayment.subscriptionId,
    });
  } else {
    logger.warn('Transaction.Failed: Payment record not found', { paymentId });
  }
}

/**
 * 결제 취소/부분 취소 처리
 */
async function handleTransactionCancelled(
  payload: Record<string, unknown>,
  eventType: 'Transaction.Cancelled' | 'Transaction.PartialCancelled'
) {
  const transactionData = extractTransactionData(payload);
  if (!transactionData?.paymentId) {
    logger.warn(`${eventType}: Missing paymentId`, { payload });
    return;
  }

  const { paymentId, amount } = transactionData;
  const status = eventType === 'Transaction.Cancelled' ? 'CANCELLED' : 'PARTIAL_REFUNDED';

  // 결제 내역 업데이트
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);

  if (existingPayment) {
    await db
      .update(payments)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existingPayment.id));

    logger.info(`Payment ${status.toLowerCase()}`, {
      paymentId,
      cancelledAmount: amount?.cancelled,
    });
  } else {
    logger.warn(`${eventType}: Payment record not found`, { paymentId });
  }
}

/**
 * 빌링키 삭제 처리
 */
async function handleBillingKeyDeleted(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined;
  const billingKey = data?.billingKey as string | undefined;

  if (!billingKey) {
    logger.warn('BillingKey.Deleted: Missing billingKey', { payload });
    return;
  }

  // 빌링키는 암호화되어 저장되므로, 직접 매칭이 어려움
  // 실제로는 PortOne에서 삭제 요청 시 우리가 먼저 DB를 업데이트하므로
  // 이 웹훅은 확인 목적으로 로깅만 수행

  logger.info('BillingKey deletion confirmed by PortOne', {
    // 빌링키 마스킹
    billingKeyPrefix: billingKey.substring(0, 8) + '***',
  });
}
