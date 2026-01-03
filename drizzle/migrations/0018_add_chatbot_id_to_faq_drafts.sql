-- faqDrafts에 chatbotId 컬럼 추가 (nullable for migration)
ALTER TABLE "faq_drafts" ADD COLUMN "chatbot_id" uuid;--> statement-breakpoint
ALTER TABLE "faq_drafts" ADD CONSTRAINT "faq_drafts_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_faq_drafts_chatbot" ON "faq_drafts" USING btree ("chatbot_id");
