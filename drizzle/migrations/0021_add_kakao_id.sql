ALTER TABLE "users" ADD COLUMN "kakao_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_kakao_id_unique" UNIQUE("kakao_id");