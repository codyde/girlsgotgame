-- Migration: Merge profiles table into user table
-- This migration adds profile fields to the user table and migrates existing data

-- Add profile columns to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "avatar_url" varchar(500);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "total_points" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'player';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "child_id" varchar(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_onboarded" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "jersey_number" integer;

-- Migrate existing profile data to user table (if profiles table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        -- Update existing user records with profile data
        UPDATE "user" 
        SET 
            "avatar_url" = p."avatar_url",
            "total_points" = p."total_points",
            "role" = p."role",
            "child_id" = p."child_id",
            "is_onboarded" = p."is_onboarded",
            "jersey_number" = p."jersey_number"
        FROM profiles p 
        WHERE "user"."id" = p."id";
        
        -- Drop the profiles table
        DROP TABLE IF EXISTS profiles CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for child_id self-reference
ALTER TABLE "user" ADD CONSTRAINT "user_child_id_fkey" 
    FOREIGN KEY ("child_id") REFERENCES "user"("id") ON DELETE SET NULL;