ALTER TABLE "users" ADD COLUMN "new_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "new_email_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "new_email_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_settings" jsonb DEFAULT '{"security":true,"usage":true,"marketing":false}'::jsonb;