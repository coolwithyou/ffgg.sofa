CREATE TABLE "chatbot_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"dataset_id" uuid NOT NULL,
	"weight" real DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_chatbot_dataset" UNIQUE("chatbot_id","dataset_id")
);
--> statement-breakpoint
CREATE TABLE "chatbots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"widget_enabled" boolean DEFAULT false,
	"widget_api_key" text,
	"widget_config" jsonb DEFAULT '{}'::jsonb,
	"kakao_enabled" boolean DEFAULT false,
	"kakao_bot_id" text,
	"kakao_config" jsonb DEFAULT '{}'::jsonb,
	"llm_config" jsonb DEFAULT '{"temperature":0.7,"maxTokens":1024,"systemPrompt":null}'::jsonb,
	"search_config" jsonb DEFAULT '{"maxChunks":5,"minScore":0.5}'::jsonb,
	"status" text DEFAULT 'active',
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chatbots_widget_api_key_unique" UNIQUE("widget_api_key"),
	CONSTRAINT "chatbots_kakao_bot_id_unique" UNIQUE("kakao_bot_id")
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "dataset_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "chatbot_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "dataset_id" uuid;--> statement-breakpoint
ALTER TABLE "chatbot_datasets" ADD CONSTRAINT "chatbot_datasets_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_datasets" ADD CONSTRAINT "chatbot_datasets_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chatbot_datasets_chatbot" ON "chatbot_datasets" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_chatbot_datasets_dataset" ON "chatbot_datasets" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "idx_chatbots_tenant" ON "chatbots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_chatbots_widget_api_key" ON "chatbots" USING btree ("widget_api_key");--> statement-breakpoint
CREATE INDEX "idx_chatbots_kakao_bot_id" ON "chatbots" USING btree ("kakao_bot_id");--> statement-breakpoint
CREATE INDEX "idx_chatbots_default" ON "chatbots" USING btree ("tenant_id","is_default");--> statement-breakpoint
CREATE INDEX "idx_datasets_tenant" ON "datasets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_datasets_default" ON "datasets" USING btree ("tenant_id","is_default");--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chunks_dataset" ON "chunks" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_chatbot" ON "conversations" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_documents_dataset" ON "documents" USING btree ("dataset_id");