CREATE TABLE "knowledge_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"parent_id" uuid,
	"path" text NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_indexed" boolean DEFAULT false NOT NULL,
	"embedding" vector(1536),
	"source_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "knowledge_pages" ADD CONSTRAINT "knowledge_pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_pages" ADD CONSTRAINT "knowledge_pages_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_pages" ADD CONSTRAINT "knowledge_pages_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_pages_tenant" ON "knowledge_pages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_pages_chatbot" ON "knowledge_pages" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_pages_parent" ON "knowledge_pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_pages_path" ON "knowledge_pages" USING btree ("path");--> statement-breakpoint
CREATE INDEX "idx_knowledge_pages_status" ON "knowledge_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_knowledge_pages_chatbot_status" ON "knowledge_pages" USING btree ("chatbot_id","status");--> statement-breakpoint
CREATE INDEX "idx_token_usage_created" ON "token_usage_logs" USING btree ("created_at");