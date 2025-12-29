-- 다중 챗봇/데이터셋 시스템 마이그레이션
-- 이 마이그레이션은 기존 1:1 Tenant-Chatbot 구조를 N:M Chatbot-Dataset 구조로 변경합니다.

-- ============================================
-- 1. datasets 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS "datasets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "document_count" integer DEFAULT 0,
  "chunk_count" integer DEFAULT 0,
  "total_storage_bytes" bigint DEFAULT 0,
  "status" text DEFAULT 'active',
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_datasets_tenant" ON "datasets" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_datasets_default" ON "datasets" USING btree ("tenant_id", "is_default");

-- ============================================
-- 2. chatbots 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS "chatbots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "widget_enabled" boolean DEFAULT false,
  "widget_api_key" text UNIQUE,
  "widget_config" jsonb DEFAULT '{}'::jsonb,
  "kakao_enabled" boolean DEFAULT false,
  "kakao_bot_id" text UNIQUE,
  "kakao_config" jsonb DEFAULT '{}'::jsonb,
  "llm_config" jsonb DEFAULT '{"temperature": 0.7, "maxTokens": 1024, "systemPrompt": null}'::jsonb,
  "search_config" jsonb DEFAULT '{"maxChunks": 5, "minScore": 0.5}'::jsonb,
  "status" text DEFAULT 'active',
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_chatbots_tenant" ON "chatbots" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_chatbots_widget_api_key" ON "chatbots" USING btree ("widget_api_key");
CREATE INDEX IF NOT EXISTS "idx_chatbots_kakao_bot_id" ON "chatbots" USING btree ("kakao_bot_id");
CREATE INDEX IF NOT EXISTS "idx_chatbots_default" ON "chatbots" USING btree ("tenant_id", "is_default");

-- ============================================
-- 3. chatbot_datasets 조인 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS "chatbot_datasets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chatbot_id" uuid NOT NULL REFERENCES "chatbots"("id") ON DELETE CASCADE,
  "dataset_id" uuid NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "weight" real DEFAULT 1.0,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "unique_chatbot_dataset" UNIQUE ("chatbot_id", "dataset_id")
);

CREATE INDEX IF NOT EXISTS "idx_chatbot_datasets_chatbot" ON "chatbot_datasets" USING btree ("chatbot_id");
CREATE INDEX IF NOT EXISTS "idx_chatbot_datasets_dataset" ON "chatbot_datasets" USING btree ("dataset_id");

-- ============================================
-- 4. documents 테이블에 dataset_id 컬럼 추가
-- ============================================
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "dataset_id" uuid REFERENCES "datasets"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_documents_dataset" ON "documents" USING btree ("dataset_id");

-- ============================================
-- 5. chunks 테이블에 dataset_id 컬럼 추가 (역정규화)
-- ============================================
ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "dataset_id" uuid REFERENCES "datasets"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_chunks_dataset" ON "chunks" USING btree ("dataset_id");

-- ============================================
-- 6. conversations 테이블에 chatbot_id 컬럼 추가
-- ============================================
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_conversations_chatbot" ON "conversations" USING btree ("chatbot_id");

-- ============================================
-- 7. 기존 데이터 마이그레이션 (각 테넌트에 기본 데이터셋/챗봇 생성)
-- ============================================

-- 7.1 각 테넌트에 기본 데이터셋 생성
INSERT INTO "datasets" ("tenant_id", "name", "description", "is_default", "created_at", "updated_at")
SELECT
  t.id,
  '기본 데이터셋',
  '자동 생성된 기본 데이터셋',
  true,
  NOW(),
  NOW()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "datasets" d WHERE d.tenant_id = t.id AND d.is_default = true
);

-- 7.2 기존 documents를 기본 데이터셋에 연결
UPDATE "documents" doc
SET "dataset_id" = ds.id
FROM "datasets" ds
WHERE doc.tenant_id = ds.tenant_id
  AND ds.is_default = true
  AND doc.dataset_id IS NULL;

-- 7.3 기존 chunks를 기본 데이터셋에 연결 (documents를 통해)
UPDATE "chunks" c
SET "dataset_id" = doc.dataset_id
FROM "documents" doc
WHERE c.document_id = doc.id
  AND c.dataset_id IS NULL
  AND doc.dataset_id IS NOT NULL;

-- 7.4 데이터셋 통계 업데이트
UPDATE "datasets" ds
SET
  "document_count" = stats.doc_count,
  "chunk_count" = stats.chunk_count,
  "total_storage_bytes" = stats.total_bytes
FROM (
  SELECT
    doc.dataset_id,
    COUNT(DISTINCT doc.id) as doc_count,
    COUNT(c.id) as chunk_count,
    COALESCE(SUM(doc.file_size), 0) as total_bytes
  FROM "documents" doc
  LEFT JOIN "chunks" c ON c.document_id = doc.id
  WHERE doc.dataset_id IS NOT NULL
  GROUP BY doc.dataset_id
) stats
WHERE ds.id = stats.dataset_id;

-- 7.5 각 테넌트에 기본 챗봇 생성 (기존 위젯/카카오 설정 이전)
INSERT INTO "chatbots" (
  "tenant_id",
  "name",
  "description",
  "widget_enabled",
  "widget_api_key",
  "widget_config",
  "kakao_enabled",
  "kakao_bot_id",
  "kakao_config",
  "is_default",
  "created_at",
  "updated_at"
)
SELECT
  t.id,
  '기본 챗봇',
  '자동 생성된 기본 챗봇',
  CASE WHEN t.settings->>'widgetApiKey' IS NOT NULL THEN true ELSE false END,
  t.settings->>'widgetApiKey',
  COALESCE(t.settings->'widgetConfig', '{}'::jsonb),
  CASE WHEN t.kakao_bot_id IS NOT NULL THEN true ELSE false END,
  t.kakao_bot_id,
  jsonb_build_object(
    'maxResponseLength', COALESCE((t.settings->>'kakaoMaxResponseLength')::int, 300),
    'welcomeMessage', t.settings->>'kakaoWelcomeMessage'
  ),
  true,
  NOW(),
  NOW()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "chatbots" cb WHERE cb.tenant_id = t.id AND cb.is_default = true
);

-- 7.6 기본 챗봇과 기본 데이터셋 연결
INSERT INTO "chatbot_datasets" ("chatbot_id", "dataset_id")
SELECT cb.id, ds.id
FROM "chatbots" cb
JOIN "datasets" ds ON cb.tenant_id = ds.tenant_id AND ds.is_default = true
WHERE cb.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM "chatbot_datasets" cd
    WHERE cd.chatbot_id = cb.id AND cd.dataset_id = ds.id
  );

-- 7.7 기존 conversations를 기본 챗봇에 연결
UPDATE "conversations" conv
SET "chatbot_id" = cb.id
FROM "chatbots" cb
WHERE conv.tenant_id = cb.tenant_id
  AND cb.is_default = true
  AND conv.chatbot_id IS NULL;

-- ============================================
-- 완료 메시지
-- ============================================
-- 마이그레이션 완료 후 다음 단계:
-- 1. 데이터 확인: SELECT * FROM datasets; SELECT * FROM chatbots; SELECT * FROM chatbot_datasets;
-- 2. documents.dataset_id, chunks.dataset_id NOT NULL 제약 추가 (선택사항, 충분한 테스트 후):
--    ALTER TABLE "documents" ALTER COLUMN "dataset_id" SET NOT NULL;
--    ALTER TABLE "chunks" ALTER COLUMN "dataset_id" SET NOT NULL;
