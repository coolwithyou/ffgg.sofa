CREATE TABLE "access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"ip_address" "inet",
	"user_agent" text,
	"result" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"integrity_hash" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"chunk_index" integer,
	"quality_score" real,
	"status" text DEFAULT 'pending',
	"auto_approved" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"channel" text DEFAULT 'web',
	"messages" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"file_type" text,
	"status" text DEFAULT 'uploaded',
	"progress_step" text,
	"progress_percent" integer DEFAULT 0,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip_address" "inet",
	"success" boolean DEFAULT false,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_user_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"permission_type" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "response_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"query_hash" text NOT NULL,
	"query_embedding" vector(1536),
	"response" text NOT NULL,
	"hit_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	CONSTRAINT "response_cache_tenant_query" UNIQUE("tenant_id","query_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"kakao_bot_id" text,
	"kakao_skill_url" text,
	"tier" text DEFAULT 'basic',
	"usage_limits" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tenants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"conversation_count" integer DEFAULT 0,
	"message_count" integer DEFAULT 0,
	"token_usage" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "usage_logs_tenant_date" UNIQUE("tenant_id","date")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"tenant_id" uuid,
	"role" text DEFAULT 'user',
	"email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"password_reset_token" text,
	"password_reset_expires" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false,
	"totp_backup_codes" jsonb,
	"failed_login_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_cache" ADD CONSTRAINT "response_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_logs_user" ON "access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_access_logs_tenant" ON "access_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_access_logs_date" ON "access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chunks_tenant" ON "chunks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_chunks_document" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_tenant" ON "conversations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_date" ON "permission_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_tenant" ON "users" USING btree ("tenant_id");