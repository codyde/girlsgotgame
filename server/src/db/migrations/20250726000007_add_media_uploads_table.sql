-- Create media uploads table for tracking all uploaded content
CREATE TABLE "media_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "uploaded_by" varchar(255) NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "original_name" varchar(255) NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "media_type" varchar(20) NOT NULL,
  "upload_url" varchar(1000) NOT NULL,
  "thumbnail_url" varchar(1000),
  "width" integer,
  "height" integer,
  "duration" integer,
  "tags" text,
  "description" text,
  "is_visible" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create index on uploaded_by for faster queries
CREATE INDEX "media_uploads_uploaded_by_idx" ON "media_uploads" ("uploaded_by");

-- Create index on media_type for filtering
CREATE INDEX "media_uploads_media_type_idx" ON "media_uploads" ("media_type");

-- Create index on is_visible for admin filtering
CREATE INDEX "media_uploads_is_visible_idx" ON "media_uploads" ("is_visible");

-- Create index on created_at for chronological sorting
CREATE INDEX "media_uploads_created_at_idx" ON "media_uploads" ("created_at" DESC);