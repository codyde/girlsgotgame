-- Add media_id column to posts table to link with media_uploads
ALTER TABLE "posts" ADD COLUMN "media_id" uuid;

-- Create index on media_id for faster joins
CREATE INDEX "posts_media_id_idx" ON "posts" ("media_id");