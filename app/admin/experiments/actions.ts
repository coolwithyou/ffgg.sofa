'use server';

/**
 * 관리자 A/B 테스트 실험 관리 - 서버 액션
 *
 * 모든 챗봇의 A/B 테스트 현황과 품질 메트릭을 조회합니다.
 */

import { db, chatbots, chatbotDatasets, chunks } from '@/lib/db';
import { sql, desc } from 'drizzle-orm';
import type { ExperimentConfig } from '@/types/experiment';

/**
 * 실험이 진행 중인 챗봇 정보
 */
export interface ExperimentChatbot {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string | null;
  experimentConfig: ExperimentConfig | null;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A/B 테스트 요약 통계
 */
export interface ExperimentSummary {
  totalChatbots: number;
  activeExperiments: number;
  totalChunksInExperiments: number;
  controlChunks: number;
  treatmentChunks: number;
  avgQualityDelta: number | null;
}

/**
 * 챗봇별 품질 메트릭
 */
export interface ChatbotExperimentMetrics {
  chatbotId: string;
  chatbotName: string;
  tenantName: string | null;
  experimentConfig: ExperimentConfig | null;
  controlChunks: number;
  treatmentChunks: number;
  controlAvgQuality: number;
  treatmentAvgQuality: number;
  qualityDelta: number;
  isSignificant: boolean;
}

/**
 * 실험 진행 중인 챗봇 목록 조회
 */
export async function getExperimentChatbots(): Promise<ExperimentChatbot[]> {
  const result = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.tenant_id as "tenantId",
      t.name as "tenantName",
      c.experiment_config as "experimentConfig",
      c.status,
      c.created_at as "createdAt",
      c.updated_at as "updatedAt"
    FROM chatbots c
    LEFT JOIN tenants t ON c.tenant_id = t.id
    WHERE c.experiment_config IS NOT NULL
      AND (c.experiment_config->>'abTestEnabled')::boolean = true
    ORDER BY c.updated_at DESC
  `);

  return (result as unknown as ExperimentChatbot[]).map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

/**
 * 전체 A/B 테스트 요약 통계
 */
export async function getExperimentSummary(): Promise<ExperimentSummary> {
  // 전체 챗봇 수
  const [totalResult] = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM chatbots
  `) as unknown as [{ count: number }];

  // A/B 테스트 활성 챗봇 수
  const [activeResult] = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM chatbots
    WHERE experiment_config IS NOT NULL
      AND (experiment_config->>'abTestEnabled')::boolean = true
  `) as unknown as [{ count: number }];

  // 실험 청크 통계
  const [chunkStats] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE metadata->>'experimentVariant' IS NOT NULL)::int as total,
      COUNT(*) FILTER (WHERE metadata->>'experimentVariant' = 'control')::int as control,
      COUNT(*) FILTER (WHERE metadata->>'experimentVariant' = 'treatment')::int as treatment,
      AVG(
        CASE WHEN metadata->>'experimentVariant' = 'treatment' THEN quality_score END
      ) - AVG(
        CASE WHEN metadata->>'experimentVariant' = 'control' THEN quality_score END
      ) as avg_delta
    FROM chunks
    WHERE metadata->>'experimentVariant' IS NOT NULL
  `) as unknown as [{
    total: number;
    control: number;
    treatment: number;
    avg_delta: number | null;
  }];

  return {
    totalChatbots: totalResult?.count || 0,
    activeExperiments: activeResult?.count || 0,
    totalChunksInExperiments: chunkStats?.total || 0,
    controlChunks: chunkStats?.control || 0,
    treatmentChunks: chunkStats?.treatment || 0,
    avgQualityDelta: chunkStats?.avg_delta
      ? Math.round(chunkStats.avg_delta * 100) / 100
      : null,
  };
}

/**
 * 챗봇별 실험 메트릭 조회
 */
export async function getChatbotExperimentMetrics(): Promise<ChatbotExperimentMetrics[]> {
  const result = await db.execute(sql`
    WITH chatbot_experiment_stats AS (
      SELECT
        cd.chatbot_id,
        ch.metadata->>'experimentVariant' as variant,
        COUNT(*)::int as chunk_count,
        COALESCE(AVG(ch.quality_score), 0)::float as avg_quality
      FROM chunks ch
      INNER JOIN chatbot_datasets cd ON ch.dataset_id = cd.dataset_id
      WHERE ch.metadata->>'experimentVariant' IS NOT NULL
      GROUP BY cd.chatbot_id, ch.metadata->>'experimentVariant'
    ),
    pivoted AS (
      SELECT
        chatbot_id,
        COALESCE(MAX(CASE WHEN variant = 'control' THEN chunk_count END), 0) as control_chunks,
        COALESCE(MAX(CASE WHEN variant = 'treatment' THEN chunk_count END), 0) as treatment_chunks,
        COALESCE(MAX(CASE WHEN variant = 'control' THEN avg_quality END), 0) as control_quality,
        COALESCE(MAX(CASE WHEN variant = 'treatment' THEN avg_quality END), 0) as treatment_quality
      FROM chatbot_experiment_stats
      GROUP BY chatbot_id
    )
    SELECT
      c.id as "chatbotId",
      c.name as "chatbotName",
      t.name as "tenantName",
      c.experiment_config as "experimentConfig",
      p.control_chunks as "controlChunks",
      p.treatment_chunks as "treatmentChunks",
      ROUND(p.control_quality::numeric, 2) as "controlAvgQuality",
      ROUND(p.treatment_quality::numeric, 2) as "treatmentAvgQuality",
      ROUND((p.treatment_quality - p.control_quality)::numeric, 2) as "qualityDelta"
    FROM pivoted p
    INNER JOIN chatbots c ON p.chatbot_id = c.id
    LEFT JOIN tenants t ON c.tenant_id = t.id
    ORDER BY p.treatment_chunks + p.control_chunks DESC
  `);

  return (result as unknown as ChatbotExperimentMetrics[]).map((row) => ({
    ...row,
    controlChunks: Number(row.controlChunks),
    treatmentChunks: Number(row.treatmentChunks),
    controlAvgQuality: Number(row.controlAvgQuality),
    treatmentAvgQuality: Number(row.treatmentAvgQuality),
    qualityDelta: Number(row.qualityDelta),
    // 최소 샘플 100개 이상, 차이 2점 이상이면 유의미
    isSignificant:
      row.controlChunks >= 100 &&
      row.treatmentChunks >= 100 &&
      Math.abs(Number(row.qualityDelta)) > 2,
  }));
}
