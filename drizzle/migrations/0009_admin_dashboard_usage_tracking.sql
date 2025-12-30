CREATE TABLE "llm_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"input_price_per_million" real NOT NULL,
	"output_price_per_million" real NOT NULL,
	"is_embedding" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_llm_model" UNIQUE("provider","model_id")
);
--> statement-breakpoint
CREATE TABLE "slack_alert_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_url" text NOT NULL,
	"channel_name" text,
	"enable_budget_alerts" boolean DEFAULT true,
	"enable_anomaly_alerts" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_budget_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"current_month_usage_usd" real DEFAULT 0,
	"last_alert_type" text,
	"last_alert_at" timestamp with time zone,
	"override_monthly_budget_usd" real,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tenant_budget_status_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tier_budget_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" text NOT NULL,
	"monthly_budget_usd" real NOT NULL,
	"daily_budget_usd" real NOT NULL,
	"alert_threshold" integer DEFAULT 80,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tier_budget_limits_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "token_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"conversation_id" uuid,
	"model_provider" text NOT NULL,
	"model_id" text NOT NULL,
	"feature_type" text NOT NULL,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"input_cost_usd" real DEFAULT 0,
	"output_cost_usd" real DEFAULT 0,
	"total_cost_usd" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"alert_channel" text NOT NULL,
	"threshold" real,
	"actual_value" real,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid
);
--> statement-breakpoint
ALTER TABLE "tenant_budget_status" ADD CONSTRAINT "tenant_budget_status_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_llm_models_active" ON "llm_models" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_tenant_budget_tenant" ON "tenant_budget_status" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_token_usage_tenant" ON "token_usage_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_token_usage_tenant_date" ON "token_usage_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_token_usage_model" ON "token_usage_logs" USING btree ("model_provider","model_id");--> statement-breakpoint
CREATE INDEX "idx_token_usage_chatbot" ON "token_usage_logs" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_usage_alerts_tenant" ON "usage_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_usage_alerts_date" ON "usage_alerts" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_usage_alerts_unack" ON "usage_alerts" USING btree ("acknowledged");--> statement-breakpoint

-- 초기 LLM 모델 가격 데이터 (2024-2025 기준)
INSERT INTO "llm_models" ("provider", "model_id", "display_name", "input_price_per_million", "output_price_per_million", "is_embedding", "is_active", "is_default") VALUES
  ('google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', 0.075, 0.30, false, true, true),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', 0.15, 0.60, false, true, false),
  ('openai', 'text-embedding-3-small', 'Text Embedding 3 Small', 0.02, 0.02, true, true, true);
--> statement-breakpoint

-- 티어별 예산 한도 초기 데이터
INSERT INTO "tier_budget_limits" ("tier", "monthly_budget_usd", "daily_budget_usd", "alert_threshold") VALUES
  ('basic', 10.0, 0.33, 80),
  ('standard', 50.0, 1.67, 80),
  ('premium', 200.0, 6.67, 80);