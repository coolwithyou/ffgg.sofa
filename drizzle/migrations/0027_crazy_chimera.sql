CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"claim_text" text NOT NULL,
	"claim_type" text NOT NULL,
	"reconstructed_location" jsonb,
	"verdict" text DEFAULT 'pending' NOT NULL,
	"confidence" real,
	"verification_level" text,
	"verification_detail" text,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"suspicion_type" text,
	"suspicion_detail" text,
	"human_verdict" text,
	"human_note" text,
	"reviewed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "source_spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"source_text" text NOT NULL,
	"start_char" integer NOT NULL,
	"end_char" integer NOT NULL,
	"page_number" integer,
	"match_score" real,
	"match_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"original_text" text NOT NULL,
	"original_pdf_url" text,
	"reconstructed_markdown" text,
	"structure_json" jsonb,
	"page_mapping" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_claims" integer DEFAULT 0,
	"supported_count" integer DEFAULT 0,
	"contradicted_count" integer DEFAULT 0,
	"not_found_count" integer DEFAULT 0,
	"high_risk_count" integer DEFAULT 0,
	"risk_score" real,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"generated_pages_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_session_id_validation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."validation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_spans" ADD CONSTRAINT "source_spans_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD CONSTRAINT "validation_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD CONSTRAINT "validation_sessions_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD CONSTRAINT "validation_sessions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD CONSTRAINT "validation_sessions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_claims_session" ON "claims" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_claims_verdict" ON "claims" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "idx_claims_risk" ON "claims" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_claims_human_verdict" ON "claims" USING btree ("human_verdict");--> statement-breakpoint
CREATE INDEX "idx_source_spans_claim" ON "source_spans" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_validation_sessions_chatbot" ON "validation_sessions" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_validation_sessions_status" ON "validation_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_validation_sessions_document" ON "validation_sessions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_validation_sessions_expires" ON "validation_sessions" USING btree ("expires_at");