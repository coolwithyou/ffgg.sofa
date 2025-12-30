ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "delete_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "delete_reason" text;