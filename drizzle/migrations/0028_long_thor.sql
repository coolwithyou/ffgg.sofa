CREATE TABLE "validation_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"previous_value" text,
	"new_value" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "validation_audit_logs" ADD CONSTRAINT "validation_audit_logs_session_id_validation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."validation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_audit_logs" ADD CONSTRAINT "validation_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_session" ON "validation_audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "validation_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "validation_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "validation_audit_logs" USING btree ("created_at");