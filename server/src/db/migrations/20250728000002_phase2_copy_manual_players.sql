-- Phase 2: Copy Manual Players to User Table
-- This migration COPIES data without removing anything
-- Safe to run multiple times (idempotent)
-- Requires Phase 1 to be completed first

BEGIN;

-- Verify Phase 1 was completed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'account_type') THEN
        RAISE EXCEPTION 'Phase 1 migration not completed. Run phase1_extend_user_table.sql first.';
    END IF;
END $$;

-- Store counts before migration for verification
CREATE TEMP TABLE migration_stats AS
SELECT 
    'before_migration' as stage,
    (SELECT COUNT(*) FROM manual_players) as manual_players_count,
    (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual') as manual_users_count,
    (SELECT COUNT(*) FROM "user") as total_users_count;

-- Report before migration stats
DO $$
DECLARE
    mp_count INT;
    mu_count INT; 
    total_count INT;
BEGIN
    SELECT manual_players_count, manual_users_count, total_users_count 
    INTO mp_count, mu_count, total_count 
    FROM migration_stats;
    
    RAISE NOTICE 'Before migration - Manual players: %, Manual users: %, Total users: %', 
        mp_count, mu_count, total_count;
END $$;

-- Copy manual players to user table
-- Using INSERT ... ON CONFLICT DO NOTHING for safety
INSERT INTO "user" (
    id,
    name,
    email,  -- Will be NULL for manual players
    account_type,
    has_login_access,
    jersey_number,
    role,
    total_points,
    is_onboarded,
    isverified,
    created_by_user_id,
    migrated_from_manual_player_id,
    "createdAt",
    "updatedAt"
)
SELECT 
    mp.id,                      -- Keep same UUID for consistency
    mp.name,
    'manual-player-' || mp.id || '@girlsgotgame.placeholder',  -- Placeholder email for manual players
    'manual',
    false,                      -- Manual players can't log in
    mp.jersey_number,
    'player',                   -- All manual players are players
    0,                          -- Manual players start with 0 points (training points don't apply)
    true,                       -- Consider them "onboarded" since they're manually created
    false,                      -- Not verified since no email
    mp.linked_by,               -- Who created this manual player
    mp.id,                      -- Track migration source
    mp.created_at,
    mp.updated_at
FROM manual_players mp
ON CONFLICT (id) DO NOTHING;  -- Prevents duplicates if script runs multiple times

-- Store counts after migration
INSERT INTO migration_stats
SELECT 
    'after_migration' as stage,
    (SELECT COUNT(*) FROM manual_players) as manual_players_count,
    (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual') as manual_users_count,
    (SELECT COUNT(*) FROM "user") as total_users_count;

-- Verification and reporting
DO $$
DECLARE
    before_manual_players INT;
    after_manual_users INT;
    migration_success BOOLEAN;
BEGIN
    SELECT manual_players_count INTO before_manual_players FROM migration_stats WHERE stage = 'before_migration';
    SELECT manual_users_count INTO after_manual_users FROM migration_stats WHERE stage = 'after_migration';
    
    migration_success := (before_manual_players = after_manual_users);
    
    RAISE NOTICE 'Phase 2 Migration Results:';
    RAISE NOTICE '  Manual players before: %', before_manual_players;
    RAISE NOTICE '  Manual users after: %', after_manual_users;
    RAISE NOTICE '  Migration successful: %', migration_success;
    
    IF NOT migration_success THEN
        RAISE WARNING 'Migration count mismatch! Check for errors.';
    END IF;
END $$;

-- Additional verification - ensure all manual players have corresponding users
DO $$
DECLARE
    missing_count INT;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM manual_players mp
    WHERE NOT EXISTS (
        SELECT 1 FROM "user" u 
        WHERE u.id::text = mp.id::text AND u.account_type = 'manual'
    );
    
    IF missing_count > 0 THEN
        RAISE WARNING 'Found % manual players without corresponding user records!', missing_count;
    ELSE
        RAISE NOTICE 'All manual players successfully copied to user table!';
    END IF;
END $$;

COMMIT;

-- Manual verification queries (run these after the migration)
/*
-- Check migrated users
SELECT 
    id, name, account_type, has_login_access, jersey_number, 
    created_by_user_id, migrated_from_manual_player_id
FROM "user" 
WHERE account_type = 'manual'
ORDER BY name;

-- Verify data integrity
SELECT 
    'manual_players' as source,
    COUNT(*) as count,
    string_agg(DISTINCT name, ', ' ORDER BY name) as sample_names
FROM manual_players
UNION ALL
SELECT 
    'migrated_users' as source,
    COUNT(*) as count,
    string_agg(DISTINCT name, ', ' ORDER BY name) as sample_names
FROM "user" 
WHERE account_type = 'manual';
*/