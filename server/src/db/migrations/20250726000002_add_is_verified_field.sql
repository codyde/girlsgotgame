-- Add isVerified field to user table
ALTER TABLE "user" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;

-- Update existing users to be unverified by default
UPDATE "user" SET "is_verified" = false WHERE "is_verified" IS NULL;