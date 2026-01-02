ALTER TABLE "chatbots" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "chatbots" ADD COLUMN "public_page_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "chatbots" ADD COLUMN "public_page_config" jsonb DEFAULT '{"header":{"title":"","description":"","logoUrl":"","showBrandName":true},"theme":{"backgroundColor":"#ffffff","primaryColor":"#3B82F6","textColor":"#1f2937"},"seo":{"title":"","description":"","ogImage":""}}'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_chatbots_slug" ON "chatbots" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_chatbots_public_page" ON "chatbots" USING btree ("slug","public_page_enabled");--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_slug_unique" UNIQUE("slug");