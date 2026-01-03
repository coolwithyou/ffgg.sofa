CREATE TABLE "chatbot_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"version_type" text NOT NULL,
	"public_page_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"widget_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"publish_note" text,
	"version_number" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "faq_drafts" ALTER COLUMN "chatbot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chatbot_config_versions" ADD CONSTRAINT "chatbot_config_versions_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_config_versions" ADD CONSTRAINT "chatbot_config_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_config_versions_chatbot" ON "chatbot_config_versions" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_config_versions_type" ON "chatbot_config_versions" USING btree ("chatbot_id","version_type");--> statement-breakpoint
CREATE INDEX "idx_config_versions_published_at" ON "chatbot_config_versions" USING btree ("chatbot_id","published_at");