CREATE TABLE "reserved_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "reserved_slugs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "reserved_slugs" ADD CONSTRAINT "reserved_slugs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reserved_slugs_slug" ON "reserved_slugs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_reserved_slugs_category" ON "reserved_slugs" USING btree ("category");