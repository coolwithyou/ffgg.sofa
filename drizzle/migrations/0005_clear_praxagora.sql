ALTER TABLE "chunks" ADD COLUMN "source_chunk_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_chunks_source" ON "chunks" USING btree ("source_chunk_id");