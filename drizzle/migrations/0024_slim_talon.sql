CREATE TABLE "slug_change_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"previous_slug" text,
	"new_slug" text NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chatbots" ADD COLUMN "experiment_config" jsonb;--> statement-breakpoint
ALTER TABLE "slug_change_logs" ADD CONSTRAINT "slug_change_logs_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_change_logs" ADD CONSTRAINT "slug_change_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_slug_change_logs_chatbot" ON "slug_change_logs" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_slug_change_logs_changed_at" ON "slug_change_logs" USING btree ("changed_at");