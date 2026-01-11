// lib/knowledge-pages/verification/risk-calculator.ts

import { db } from '@/lib/db';
import { claims, validationSessions } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import type { RiskLevel } from '../types';

/**
 * 검증 세션의 전체 위험도 점수 계산
 *
 * 점수 계산 공식:
 * score = (contradicted * 3 + notFound * 2 + highRisk * 1.5) / (totalClaims * 3)
 *
 * 범위: 0.0 (안전) ~ 1.0 (위험)
 */
export async function calculateRiskScore(sessionId: string): Promise<number> {
  const allClaims = await db.query.claims.findMany({
    where: eq(claims.sessionId, sessionId),
  });

  if (allClaims.length === 0) {
    await db
      .update(validationSessions)
      .set({ riskScore: 0 })
      .where(eq(validationSessions.id, sessionId));
    return 0;
  }

  const contradictedCount = allClaims.filter(
    (c) => c.verdict === 'contradicted'
  ).length;
  const notFoundCount = allClaims.filter((c) => c.verdict === 'not_found').length;
  const highRiskCount = allClaims.filter((c) => c.riskLevel === 'high').length;

  // 가중치 적용 점수 계산
  const weightedScore =
    (contradictedCount * 3 + notFoundCount * 2 + highRiskCount * 1.5) /
    (allClaims.length * 3);

  const riskScore = Math.min(1, Math.max(0, weightedScore));

  // CONTRADICTED인 Claim은 자동으로 High Risk로 승격
  await db
    .update(claims)
    .set({ riskLevel: 'high' })
    .where(
      and(eq(claims.sessionId, sessionId), eq(claims.verdict, 'contradicted'))
    );

  // 세션 위험도 점수 업데이트
  const updatedHighRiskCount = allClaims.filter(
    (c) => c.verdict === 'contradicted' || c.riskLevel === 'high'
  ).length;

  const supportedCount = allClaims.filter((c) => c.verdict === 'supported').length;

  await db
    .update(validationSessions)
    .set({
      riskScore,
      totalClaims: allClaims.length,
      supportedCount,
      contradictedCount,
      notFoundCount,
      highRiskCount: updatedHighRiskCount,
    })
    .where(eq(validationSessions.id, sessionId));

  return riskScore;
}

/**
 * 개별 Claim의 위험도 레벨 결정
 */
export function assignRiskLevel(claim: {
  claimType: string;
  verdict?: string;
}): RiskLevel {
  // CONTRADICTED는 무조건 High
  if (claim.verdict === 'contradicted') return 'high';

  // 타입별 기본 위험도
  const typeRiskMap: Record<string, RiskLevel> = {
    contact: 'high', // 연락처 오류는 치명적
    numeric: 'high', // 숫자 오류도 치명적
    date: 'medium', // 날짜는 중간
    table: 'medium', // 테이블 구조
    list: 'low', // 목록
    text: 'low', // 일반 텍스트
  };

  return typeRiskMap[claim.claimType] || 'low';
}
