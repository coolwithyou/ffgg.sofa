CREATE TABLE "knowledge_page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"version_type" text NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"path" text NOT NULL,
	"embedding" vector(1536),
	"published_at" timestamp with time zone NOT NULL,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "knowledge_pages" ADD COLUMN "published_version_id" uuid;--> statement-breakpoint
ALTER TABLE "knowledge_page_versions" ADD CONSTRAINT "knowledge_page_versions_page_id_knowledge_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."knowledge_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_page_versions" ADD CONSTRAINT "knowledge_page_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_kp_versions_page" ON "knowledge_page_versions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_kp_versions_page_type" ON "knowledge_page_versions" USING btree ("page_id","version_type");--> statement-breakpoint
CREATE INDEX "idx_kp_versions_type" ON "knowledge_page_versions" USING btree ("version_type");