CREATE TABLE "faq_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text DEFAULT '새 FAQ' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"qa_pairs" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "faq_drafts" ADD CONSTRAINT "faq_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_faq_drafts_tenant" ON "faq_drafts" USING btree ("tenant_id");