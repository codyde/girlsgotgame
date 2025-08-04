-- Add created_by column to user table for unified player system
ALTER TABLE "user" ADD COLUMN "created_by" varchar(20) NOT NULL DEFAULT 'oauth';

-- Update existing users to have 'oauth' as created_by (since they were created via OAuth)
-- This is already handled by the DEFAULT value, but making it explicit
UPDATE "user" SET "created_by" = 'oauth' WHERE "created_by" IS NULL;