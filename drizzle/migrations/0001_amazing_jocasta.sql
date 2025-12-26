CREATE TABLE "document_processing_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"step" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"error_stack" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "content_tsv" text;--> statement-breakpoint
ALTER TABLE "document_processing_logs" ADD CONSTRAINT "document_processing_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_logs" ADD CONSTRAINT "document_processing_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doc_logs_document" ON "document_processing_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_doc_logs_tenant" ON "document_processing_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_doc_logs_created" ON "document_processing_logs" USING btree ("created_at");