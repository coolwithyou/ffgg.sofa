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
    passwordHash: text('password_hash').notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    role: text('role').default('user'), // user, admin, internal_operator
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
// 문서
// ============================================
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    fileType: text('file_type'),
    status: text('status').default('uploaded'), // uploaded, processing, chunked, reviewing, approved, failed
    progressStep: text('progress_step'), // parsing, chunking, embedding, quality_check
    progressPercent: integer('progress_percent').default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_documents_tenant').on(table.tenantId)]
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
    sessionId: text('session_id').notNull(),
    channel: text('channel').default('web'), // web, kakao
    messages: jsonb('messages').default([]),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_conversations_tenant').on(table.tenantId)]
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
