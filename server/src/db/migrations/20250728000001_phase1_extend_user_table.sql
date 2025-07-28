-- Phase 1: Extend User Table for Unified Player System
-- This migration is ADDITIVE ONLY - no data removal or breaking changes
-- Safe to run multiple times (idempotent)

BEGIN;

-- Add new columns to user table for unified player system
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "account_type" varchar(20) DEFAULT 'registered';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "has_login_access" boolean DEFAULT true;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "created_by_user_id" varchar(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "migrated_from_manual_player_id" uuid;

-- Add helpful comments
COMMENT ON COLUMN "user"."account_type" IS 'Type of account: registered (normal users) or manual (created by admin)';
COMMENT ON COLUMN "user"."has_login_access" IS 'Whether user can log in - false for manual players';
COMMENT ON COLUMN "user"."created_by_user_id" IS 'For manual accounts, which admin created them';
COMMENT ON COLUMN "user"."migrated_from_manual_player_id" IS 'Source manual_player ID if migrated from manual_players table';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "user_account_type_idx" ON "user" ("account_type");
CREATE INDEX IF NOT EXISTS "user_has_login_access_idx" ON "user" ("has_login_access");
CREATE INDEX IF NOT EXISTS "user_created_by_user_id_idx" ON "user" ("created_by_user_id");
CREATE INDEX IF NOT EXISTS "user_migrated_from_manual_player_id_idx" ON "user" ("migrated_from_manual_player_id");

-- Update existing users to have proper account_type
UPDATE "user" 
SET account_type = 'registered', has_login_access = true 
WHERE account_type IS NULL OR account_type = 'registered';

-- Verification queries
DO $$
BEGIN
    RAISE NOTICE 'Phase 1 Migration Complete!';
    RAISE NOTICE 'Total users: %', (SELECT COUNT(*) FROM "user");
    RAISE NOTICE 'Registered users: %', (SELECT COUNT(*) FROM "user" WHERE account_type = 'registered');
    RAISE NOTICE 'Manual users: %', (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual');
    RAISE NOTICE 'Users with login access: %', (SELECT COUNT(*) FROM "user" WHERE has_login_access = true);
END $$;

COMMIT;

-- Additional verification - run this manually to double-check
-- SELECT account_type, has_login_access, COUNT(*) as count 
-- FROM "user" 
-- GROUP BY account_type, has_login_access 
-- ORDER BY account_type;