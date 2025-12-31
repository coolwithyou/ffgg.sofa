import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  jsonb,
  timestamp,
  inet,
  date,
  index,
  unique,
  vector,
  bigint,
} from 'drizzle-orm/pg-core';

// ============================================
// 테넌트 (고객사)
// ============================================
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  settings: jsonb('settings').default({}),
  kakaoBotId: text('kakao_bot_id'),
  kakaoSkillUrl: text('kakao_skill_url'),
  tier: text('tier').default('basic'), // basic, standard, premium
  usageLimits: jsonb('usage_limits').default({}),
  status: text('status').default('active'), // active, inactive, suspended
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// 사용자 (iron-session 기반 자체 인증)
// ============================================
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').unique().notNull(),
    name: text('name'), // 사용자 이름 (마이페이지용)
    passwordHash: text('password_hash').notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    role: text('role').default('user'), // user, admin, internal_operator
    avatarUrl: text('avatar_url'), // 프로필 이미지 URL (Data URL 또는 외부 URL)
    emailVerified: boolean('email_verified').default(false),
    emailVerificationToken: text('email_verification_token'),
    passwordResetToken: text('password_reset_token'),
    passwordResetExpires: timestamp('password_reset_expires', {
      withTimezone: true,
    }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    // 2FA (TOTP)
    totpSecret: text('totp_secret'), // 암호화 저장 권장
    totpEnabled: boolean('totp_enabled').default(false),
    totpBackupCodes: jsonb('totp_backup_codes'), // 백업 코드 (해시 저장)
    failedLoginCount: integer('failed_login_count').default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    // 이메일 변경
    newEmail: text('new_email'), // 변경 예정 이메일
    newEmailToken: text('new_email_token'), // 변경 인증 토큰
    newEmailExpires: timestamp('new_email_expires', { withTimezone: true }), // 토큰 만료 시간
    // 알림 설정
    notificationSettings: jsonb('notification_settings').default({
      security: true,
      usage: true,
      marketing: false,
    }),
    // 계정 삭제 관련 (30일 유예)
    deletedAt: timestamp('deleted_at', { withTimezone: true }), // 실제 삭제일
    deleteScheduledAt: timestamp('delete_scheduled_at', { withTimezone: true }), // 삭제 예정일
    deleteReason: text('delete_reason'), // 탈퇴 사유 (선택)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_tenant').on(table.tenantId),
  ]
);

// ============================================
// 세션 (iron-session 백업/검증용)
// ============================================
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').unique().notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_expires').on(table.expiresAt),
  ]
);

// ============================================
// 데이터셋 (문서 그룹)
// ============================================
export const datasets = pgTable(
  'datasets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    documentCount: integer('document_count').default(0),
    chunkCount: integer('chunk_count').default(0),
    totalStorageBytes: bigint('total_storage_bytes', { mode: 'number' }).default(0),
    status: text('status').default('active'), // active, archived
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_datasets_tenant').on(table.tenantId),
    index('idx_datasets_default').on(table.tenantId, table.isDefault),
  ]
);

// ============================================
// 챗봇
// ============================================
export const chatbots = pgTable(
  'chatbots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),

    // 위젯 배포 설정
    widgetEnabled: boolean('widget_enabled').default(false),
    widgetApiKey: text('widget_api_key').unique(),
    widgetConfig: jsonb('widget_config').default({}),

    // 카카오 연동 설정
    kakaoEnabled: boolean('kakao_enabled').default(false),
    kakaoBotId: text('kakao_bot_id').unique(),
    kakaoConfig: jsonb('kakao_config').default({}),

    // LLM 설정
    llmConfig: jsonb('llm_config').default({
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: null,
    }),

    // 검색 설정
    searchConfig: jsonb('search_config').default({
      maxChunks: 5,
      minScore: 0.5,
    }),

    // 페르소나 설정 (Intent-Aware RAG)
    personaConfig: jsonb('persona_config').default({
      name: 'AI 어시스턴트',
      expertiseArea: '기업 문서 및 FAQ',
      tone: 'friendly',
    }),

    status: text('status').default('active'), // active, inactive
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_chatbots_tenant').on(table.tenantId),
    index('idx_chatbots_widget_api_key').on(table.widgetApiKey),
    index('idx_chatbots_kakao_bot_id').on(table.kakaoBotId),
    index('idx_chatbots_default').on(table.tenantId, table.isDefault),
  ]
);

// ============================================
// 챗봇-데이터셋 연결 (N:M)
// ============================================
export const chatbotDatasets = pgTable(
  'chatbot_datasets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    weight: real('weight').default(1.0), // 검색 가중치 (향후 확장)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('unique_chatbot_dataset').on(table.chatbotId, table.datasetId),
    index('idx_chatbot_datasets_chatbot').on(table.chatbotId),
    index('idx_chatbot_datasets_dataset').on(table.datasetId),
  ]
);

// ============================================
// 문서
// ============================================
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id').references(() => datasets.id, {
      onDelete: 'cascade',
    }), // nullable for migration, will be set to NOT NULL after migration
    filename: text('filename').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    fileType: text('file_type'),
    status: text('status').default('uploaded'), // uploaded, processing, chunked, reviewing, approved, failed
    progressStep: text('progress_step'), // parsing, chunking, context_generation, embedding, quality_check
    progressPercent: integer('progress_percent').default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_documents_tenant').on(table.tenantId),
    index('idx_documents_dataset').on(table.datasetId),
  ]
);

// ============================================
// 청크 (pgvector 네이티브 지원)
// ============================================
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id').references(() => datasets.id, {
      onDelete: 'cascade',
    }), // nullable - null이면 라이브러리, 값이 있으면 해당 데이터셋 소속
    sourceChunkId: uuid('source_chunk_id'), // 복사된 청크의 원본 ID (null이면 원본 청크)
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }), // OpenAI text-embedding-3-small 1536차원
    contentTsv: text('content_tsv'), // Hybrid Retrieval용 tsvector (마이그레이션에서 generated column으로 설정)
    chunkIndex: integer('chunk_index'),
    qualityScore: real('quality_score'),
    status: text('status').default('pending'), // pending, approved, rejected, modified
    autoApproved: boolean('auto_approved').default(false),
    version: integer('version').default(1),
    isActive: boolean('is_active').default(true),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_chunks_tenant').on(table.tenantId),
    index('idx_chunks_document').on(table.documentId),
    index('idx_chunks_dataset').on(table.datasetId),
    index('idx_chunks_source').on(table.sourceChunkId),
  ]
);

// ============================================
// 대화
// ============================================
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, {
      onDelete: 'set null',
    }), // nullable for backward compatibility
    sessionId: text('session_id').notNull(),
    channel: text('channel').default('web'), // web, kakao
    messages: jsonb('messages').default([]),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_conversations_tenant').on(table.tenantId),
    index('idx_conversations_chatbot').on(table.chatbotId),
  ]
);

// ============================================
// 사용량 로그 (과금용)
// ============================================
export const usageLogs = pgTable(
  'usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    conversationCount: integer('conversation_count').default(0),
    messageCount: integer('message_count').default(0),
    tokenUsage: integer('token_usage').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [unique('usage_logs_tenant_date').on(table.tenantId, table.date)]
);

// ============================================
// 응답 캐시
// ============================================
export const responseCache = pgTable(
  'response_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    queryHash: text('query_hash').notNull(),
    queryEmbedding: vector('query_embedding', { dimensions: 1536 }), // OpenAI text-embedding-3-small 1536차원
    response: text('response').notNull(),
    hitCount: integer('hit_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [unique('response_cache_tenant_query').on(table.tenantId, table.queryHash)]
);

// ============================================
// 접속기록 로그 (F36, 개인정보보호법 준수)
// ============================================
export const accessLogs = pgTable(
  'access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    result: text('result'), // success, failure
    details: jsonb('details').default({}),
    integrityHash: text('integrity_hash'), // 무결성 검증용
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_access_logs_user').on(table.userId),
    index('idx_access_logs_tenant').on(table.tenantId),
    index('idx_access_logs_date').on(table.createdAt),
  ]
);

// ============================================
// 권한 변경 이력 (3년 보관)
// ============================================
export const permissionAuditLog = pgTable(
  'permission_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetUserId: uuid('target_user_id').notNull(),
    actorUserId: uuid('actor_user_id').notNull(),
    action: text('action').notNull(), // grant, modify, revoke
    permissionType: text('permission_type').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    reason: text('reason'),
    ipAddress: inet('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_permission_audit_date').on(table.createdAt)]
);

// ============================================
// 문서 처리 로그 (처리 상태 추적)
// ============================================
export const documentProcessingLogs = pgTable(
  'document_processing_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    step: text('step').notNull(), // started, parsing, chunking, embedding, quality_check, completed, failed
    status: text('status').notNull(), // started, completed, failed
    message: text('message'),
    details: jsonb('details').default({}),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_doc_logs_document').on(table.documentId),
    index('idx_doc_logs_tenant').on(table.tenantId),
    index('idx_doc_logs_created').on(table.createdAt),
  ]
);

// ============================================
// 로그인 시도 기록 (계정 잠금용)
// ============================================
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    ipAddress: inet('ip_address'),
    success: boolean('success').default(false),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_login_attempts_email').on(table.email)]
);

// ============================================
// FAQ 초안 (FAQ 빌더용)
// ============================================
export const faqDrafts = pgTable(
  'faq_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('새 FAQ'),
    categories: jsonb('categories').default([]), // { id, name, order }[]
    qaPairs: jsonb('qa_pairs').default([]), // { id, categoryId, question, answer, order }[]
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_faq_drafts_tenant').on(table.tenantId)]
);

// ============================================
// 토큰 사용량 상세 로그 (어드민 대시보드용)
// ============================================
export const tokenUsageLogs = pgTable(
  'token_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, {
      onDelete: 'set null',
    }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    modelProvider: text('model_provider').notNull(), // 'google', 'openai'
    modelId: text('model_id').notNull(), // 'gemini-2.5-flash-lite', 'gpt-4o-mini', 'text-embedding-3-small'
    featureType: text('feature_type').notNull(), // 'chat', 'embedding', 'rewrite'
    inputTokens: integer('input_tokens').default(0),
    outputTokens: integer('output_tokens').default(0),
    totalTokens: integer('total_tokens').default(0),
    inputCostUsd: real('input_cost_usd').default(0),
    outputCostUsd: real('output_cost_usd').default(0),
    totalCostUsd: real('total_cost_usd').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_token_usage_tenant').on(table.tenantId),
    index('idx_token_usage_tenant_date').on(table.tenantId, table.createdAt),
    index('idx_token_usage_model').on(table.modelProvider, table.modelId),
    index('idx_token_usage_chatbot').on(table.chatbotId),
  ]
);

// ============================================
// LLM 모델 가격 마스터
// ============================================
export const llmModels = pgTable(
  'llm_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(), // 'google', 'openai', 'anthropic'
    modelId: text('model_id').notNull(), // 'gemini-2.5-flash-lite', 'gpt-4o-mini', etc.
    displayName: text('display_name').notNull(),
    inputPricePerMillion: real('input_price_per_million').notNull(), // USD per 1M tokens
    outputPricePerMillion: real('output_price_per_million').notNull(),
    isEmbedding: boolean('is_embedding').default(false), // 임베딩 모델 여부
    isActive: boolean('is_active').default(true),
    isDefault: boolean('is_default').default(false), // 기본 모델 여부
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('unique_llm_model').on(table.provider, table.modelId),
    index('idx_llm_models_active').on(table.isActive),
  ]
);

// ============================================
// 티어별 예산 한도
// ============================================
export const tierBudgetLimits = pgTable(
  'tier_budget_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tier: text('tier').notNull().unique(), // 'basic', 'standard', 'premium'
    monthlyBudgetUsd: real('monthly_budget_usd').notNull(),
    dailyBudgetUsd: real('daily_budget_usd').notNull(),
    alertThreshold: integer('alert_threshold').default(80), // 80%에서 경고
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }
);

// ============================================
// 테넌트별 예산 상태
// ============================================
export const tenantBudgetStatus = pgTable(
  'tenant_budget_status',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    currentMonthUsageUsd: real('current_month_usage_usd').default(0),
    lastAlertType: text('last_alert_type'), // 'warning', 'critical', 'exceeded'
    lastAlertAt: timestamp('last_alert_at', { withTimezone: true }),
    overrideMonthlyBudgetUsd: real('override_monthly_budget_usd'), // 관리자 수동 설정 (null이면 티어 기본값)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_tenant_budget_tenant').on(table.tenantId)]
);

// ============================================
// 사용량 알림 이력
// ============================================
export const usageAlerts = pgTable(
  'usage_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    alertType: text('alert_type').notNull(), // 'budget_warning', 'budget_critical', 'budget_exceeded', 'anomaly_spike', 'anomaly_pattern'
    alertChannel: text('alert_channel').notNull(), // 'email', 'slack'
    threshold: real('threshold'), // 예: 80 (80%)
    actualValue: real('actual_value'), // 예: 85 (85%)
    message: text('message').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
    acknowledged: boolean('acknowledged').default(false),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  },
  (table) => [
    index('idx_usage_alerts_tenant').on(table.tenantId),
    index('idx_usage_alerts_date').on(table.sentAt),
    index('idx_usage_alerts_unack').on(table.acknowledged),
  ]
);

// ============================================
// Slack 알림 설정
// ============================================
export const slackAlertSettings = pgTable('slack_alert_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookUrl: text('webhook_url').notNull(),
  channelName: text('channel_name'), // 표시용 채널명
  enableBudgetAlerts: boolean('enable_budget_alerts').default(true),
  enableAnomalyAlerts: boolean('enable_anomaly_alerts').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// 응답 시간 로그 (개별 요청)
// ============================================
export const responseTimeLogs = pgTable(
  'response_time_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, {
      onDelete: 'set null',
    }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    channel: text('channel').default('web'), // web, kakao

    // 전체 응답 시간
    totalDurationMs: integer('total_duration_ms').notNull(),

    // 단계별 상세 시간 (JSONB)
    timings: jsonb('timings').default({}).$type<{
      chatbot_lookup?: number;
      session_lookup?: number;
      cache_lookup?: number;
      history_lookup?: number;
      query_rewriting?: number;
      hybrid_search?: number;
      llm_generation?: number;
      message_save?: number;
      usage_log?: number;
      cache_save?: number;
    }>(),

    // 주요 단계별 시간 (인덱싱 및 집계용 개별 컬럼)
    llmDurationMs: integer('llm_duration_ms'),
    searchDurationMs: integer('search_duration_ms'),
    rewriteDurationMs: integer('rewrite_duration_ms'),

    // 캐시 히트 여부
    cacheHit: boolean('cache_hit').default(false),

    // 메타데이터
    chunksUsed: integer('chunks_used').default(0),
    estimatedTokens: integer('estimated_tokens').default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_response_time_tenant').on(table.tenantId),
    index('idx_response_time_tenant_date').on(table.tenantId, table.createdAt),
    index('idx_response_time_chatbot').on(table.chatbotId),
    index('idx_response_time_created').on(table.createdAt),
    index('idx_response_time_total').on(table.totalDurationMs),
  ]
);

// ============================================
// 응답 시간 집계 통계
// ============================================
export const responseTimeStats = pgTable(
  'response_time_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, {
      onDelete: 'cascade',
    }),

    // 집계 기간
    periodType: text('period_type').notNull(), // 'hourly', 'daily'
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),

    // 기본 통계
    requestCount: integer('request_count').default(0),
    cacheHitCount: integer('cache_hit_count').default(0),

    // 전체 응답 시간 통계
    totalAvgMs: real('total_avg_ms'),
    totalP50Ms: real('total_p50_ms'),
    totalP95Ms: real('total_p95_ms'),
    totalP99Ms: real('total_p99_ms'),
    totalMinMs: integer('total_min_ms'),
    totalMaxMs: integer('total_max_ms'),

    // LLM 응답 시간 통계
    llmAvgMs: real('llm_avg_ms'),
    llmP95Ms: real('llm_p95_ms'),

    // 검색 시간 통계
    searchAvgMs: real('search_avg_ms'),
    searchP95Ms: real('search_p95_ms'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('unique_response_stats').on(
      table.tenantId,
      table.chatbotId,
      table.periodType,
      table.periodStart
    ),
    index('idx_response_stats_tenant').on(table.tenantId),
    index('idx_response_stats_period').on(table.periodType, table.periodStart),
  ]
);

// ============================================
// 응답 시간 임계치 설정
// ============================================
export const responseTimeThresholds = pgTable(
  'response_time_thresholds',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 적용 범위 (null이면 전역, 값이 있으면 해당 테넌트/챗봇에 적용)
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, {
      onDelete: 'cascade',
    }),

    // 임계치 설정
    p95ThresholdMs: integer('p95_threshold_ms').default(3000), // P95 3초 기본값
    avgSpikeThreshold: real('avg_spike_threshold').default(150), // 평균 150% 급증

    // 알림 설정
    alertEnabled: boolean('alert_enabled').default(true),
    alertCooldownMinutes: integer('alert_cooldown_minutes').default(60), // 1시간 쿨다운

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('unique_response_threshold').on(table.tenantId, table.chatbotId),
  ]
);

// ============================================
// 타입 추론용 exports
// ============================================
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type AccessLog = typeof accessLogs.$inferSelect;
export type NewAccessLog = typeof accessLogs.$inferInsert;

export type DocumentProcessingLog = typeof documentProcessingLogs.$inferSelect;
export type NewDocumentProcessingLog = typeof documentProcessingLogs.$inferInsert;

export type FAQDraft = typeof faqDrafts.$inferSelect;
export type NewFAQDraft = typeof faqDrafts.$inferInsert;

export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;

export type Chatbot = typeof chatbots.$inferSelect;
export type NewChatbot = typeof chatbots.$inferInsert;

export type ChatbotDataset = typeof chatbotDatasets.$inferSelect;
export type NewChatbotDataset = typeof chatbotDatasets.$inferInsert;

export type TokenUsageLog = typeof tokenUsageLogs.$inferSelect;
export type NewTokenUsageLog = typeof tokenUsageLogs.$inferInsert;

export type LlmModel = typeof llmModels.$inferSelect;
export type NewLlmModel = typeof llmModels.$inferInsert;

export type TierBudgetLimit = typeof tierBudgetLimits.$inferSelect;
export type NewTierBudgetLimit = typeof tierBudgetLimits.$inferInsert;

export type TenantBudgetStatus = typeof tenantBudgetStatus.$inferSelect;
export type NewTenantBudgetStatus = typeof tenantBudgetStatus.$inferInsert;

export type UsageAlert = typeof usageAlerts.$inferSelect;
export type NewUsageAlert = typeof usageAlerts.$inferInsert;

export type SlackAlertSetting = typeof slackAlertSettings.$inferSelect;
export type NewSlackAlertSetting = typeof slackAlertSettings.$inferInsert;

export type ResponseTimeLog = typeof responseTimeLogs.$inferSelect;
export type NewResponseTimeLog = typeof responseTimeLogs.$inferInsert;

export type ResponseTimeStat = typeof responseTimeStats.$inferSelect;
export type NewResponseTimeStat = typeof responseTimeStats.$inferInsert;

export type ResponseTimeThreshold = typeof responseTimeThresholds.$inferSelect;
export type NewResponseTimeThreshold = typeof responseTimeThresholds.$inferInsert;
