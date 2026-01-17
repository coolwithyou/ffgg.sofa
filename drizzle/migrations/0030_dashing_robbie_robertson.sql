ALTER TABLE "validation_sessions" ADD COLUMN "current_step" text;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD COLUMN "total_steps" integer DEFAULT 4;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD COLUMN "completed_steps" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "validation_sessions" ADD COLUMN "processed_claims" integer DEFAULT 0;