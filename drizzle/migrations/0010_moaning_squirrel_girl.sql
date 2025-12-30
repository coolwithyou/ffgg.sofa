CREATE TABLE "response_time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"conversation_id" uuid,
	"channel" text DEFAULT 'web',
	"total_duration_ms" integer NOT NULL,
	"timings" jsonb DEFAULT '{}'::jsonb,
	"llm_duration_ms" integer,
	"search_duration_ms" integer,
	"rewrite_duration_ms" integer,
	"cache_hit" boolean DEFAULT false,
	"chunks_used" integer DEFAULT 0,
	"estimated_tokens" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "response_time_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"period_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0,
	"cache_hit_count" integer DEFAULT 0,
	"total_avg_ms" real,
	"total_p50_ms" real,
	"total_p95_ms" real,
	"total_p99_ms" real,
	"total_min_ms" integer,
	"total_max_ms" integer,
	"llm_avg_ms" real,
	"llm_p95_ms" real,
	"search_avg_ms" real,
	"search_p95_ms" real,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_response_stats" UNIQUE("tenant_id","chatbot_id","period_type","period_start")
);
--> statement-breakpoint
CREATE TABLE "response_time_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"chatbot_id" uuid,
	"p95_threshold_ms" integer DEFAULT 3000,
	"avg_spike_threshold" real DEFAULT 150,
	"alert_enabled" boolean DEFAULT true,
	"alert_cooldown_minutes" integer DEFAULT 60,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_response_threshold" UNIQUE("tenant_id","chatbot_id")
);
--> statement-breakpoint
ALTER TABLE "response_time_logs" ADD CONSTRAINT "response_time_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_time_logs" ADD CONSTRAINT "response_time_logs_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_time_logs" ADD CONSTRAINT "response_time_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_time_stats" ADD CONSTRAINT "response_time_stats_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_time_stats" ADD CONSTRAINT "response_time_stats_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_time_thresholds" ADD CONSTRAINT "response_time_thresholds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_time_thresholds" ADD CONSTRAINT "response_time_thresholds_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_response_time_tenant" ON "response_time_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_response_time_tenant_date" ON "response_time_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_response_time_chatbot" ON "response_time_logs" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_response_time_created" ON "response_time_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_response_time_total" ON "response_time_logs" USING btree ("total_duration_ms");--> statement-breakpoint
CREATE INDEX "idx_response_stats_tenant" ON "response_time_stats" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_response_stats_period" ON "response_time_stats" USING btree ("period_type","period_start");