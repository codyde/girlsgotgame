-- Phase 4: Extend Game Players Table for Unified User System
-- This migration adds unified_user_id column and populates it
-- Safe to run multiple times (idempotent)
-- Requires Phase 1, 2, and 3 to be completed first

BEGIN;

-- Verify previous phases were completed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "user" WHERE account_type = 'manual') THEN
        RAISE EXCEPTION 'Previous phases not completed. Run phases 1-3 first.';
    END IF;
END $$;

-- Add unified_user_id column to game_players table
ALTER TABLE "game_players" ADD COLUMN IF NOT EXISTS "unified_user_id" varchar(255);

-- Add comment for documentation
COMMENT ON COLUMN "game_players"."unified_user_id" IS 'Unified reference to user table - replaces separate user_id and manual_player_id columns';

-- Create index for performance
CREATE INDEX IF NOT EXISTS "game_players_unified_user_id_idx" ON "game_players" ("unified_user_id");

-- Store counts before migration for verification
CREATE TEMP TABLE game_player_stats AS
SELECT 
    'before_migration' as stage,
    (SELECT COUNT(*) FROM game_players) as total_game_players,
    (SELECT COUNT(*) FROM game_players WHERE user_id IS NOT NULL) as registered_player_games,
    (SELECT COUNT(*) FROM game_players WHERE manual_player_id IS NOT NULL) as manual_player_games,
    (SELECT COUNT(*) FROM game_players WHERE unified_user_id IS NOT NULL) as unified_player_games;

-- Report before migration
DO $$
DECLARE
    total_gp INT;
    reg_gp INT;
    man_gp INT;
    uni_gp INT;
BEGIN
    SELECT total_game_players, registered_player_games, manual_player_games, unified_player_games
    INTO total_gp, reg_gp, man_gp, uni_gp
    FROM game_player_stats WHERE stage = 'before_migration';
    
    RAISE NOTICE 'Before migration - Total game players: %, Registered: %, Manual: %, Unified: %',
        total_gp, reg_gp, man_gp, uni_gp;
END $$;

-- Populate unified_user_id for registered players
UPDATE game_players 
SET unified_user_id = user_id 
WHERE user_id IS NOT NULL 
AND unified_user_id IS NULL;

-- Populate unified_user_id for manual players
-- These manual_player_id values should now exist as user.id from Phase 2
UPDATE game_players 
SET unified_user_id = manual_player_id 
WHERE manual_player_id IS NOT NULL 
AND unified_user_id IS NULL;

-- Store counts after migration
INSERT INTO game_player_stats
SELECT 
    'after_migration' as stage,
    (SELECT COUNT(*) FROM game_players) as total_game_players,
    (SELECT COUNT(*) FROM game_players WHERE user_id IS NOT NULL) as registered_player_games,
    (SELECT COUNT(*) FROM game_players WHERE manual_player_id IS NOT NULL) as manual_player_games,
    (SELECT COUNT(*) FROM game_players WHERE unified_user_id IS NOT NULL) as unified_player_games;

-- Verification and reporting
DO $$
DECLARE
    before_total INT;
    after_unified INT;
    migration_success BOOLEAN;
    missing_unified INT;
BEGIN
    SELECT total_game_players INTO before_total FROM game_player_stats WHERE stage = 'before_migration';
    SELECT unified_player_games INTO after_unified FROM game_player_stats WHERE stage = 'after_migration';
    
    migration_success := (before_total = after_unified);
    
    RAISE NOTICE 'Phase 4 Migration Results:';
    RAISE NOTICE '  Total game players: %', before_total;
    RAISE NOTICE '  Unified after migration: %', after_unified;
    RAISE NOTICE '  Migration successful: %', migration_success;
    
    IF NOT migration_success THEN
        -- Check what's missing
        SELECT COUNT(*) INTO missing_unified
        FROM game_players 
        WHERE unified_user_id IS NULL;
        
        RAISE WARNING 'Migration incomplete! % game players missing unified_user_id', missing_unified;
    END IF;
END $$;

-- Verify unified_user_id references exist in user table
DO $$
DECLARE
    orphaned_game_players INT;
BEGIN
    SELECT COUNT(*) INTO orphaned_game_players
    FROM game_players gp
    WHERE gp.unified_user_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM "user" u 
        WHERE u.id = gp.unified_user_id
    );
    
    IF orphaned_game_players > 0 THEN
        RAISE WARNING 'Found % game players with invalid unified_user_id references!', orphaned_game_players;
        
        -- Log count only for simplicity
        RAISE NOTICE 'Check manually for details on invalid references';
    ELSE
        RAISE NOTICE 'All unified_user_id references are valid!';
    END IF;
END $$;

-- Check for game players that couldn't be unified
DO $$
DECLARE
    unprocessed_players INT;
BEGIN
    SELECT COUNT(*) INTO unprocessed_players
    FROM game_players 
    WHERE unified_user_id IS NULL;
    
    IF unprocessed_players > 0 THEN
        RAISE WARNING 'Found % game players that could not be unified!', unprocessed_players;
        
        -- Log count only for simplicity
        RAISE NOTICE 'Check manually for details on unprocessed players';
    ELSE
        RAISE NOTICE 'All game players successfully unified!';
    END IF;
END $$;

COMMIT;

-- Manual verification queries (run these after the migration)
/*
-- Check unified game players by type
SELECT 
    u.account_type,
    COUNT(*) as game_participations,
    COUNT(DISTINCT u.id) as unique_players,
    COUNT(DISTINCT gp.game_id) as unique_games
FROM game_players gp
JOIN "user" u ON gp.unified_user_id = u.id
GROUP BY u.account_type
ORDER BY u.account_type;

-- Sample of unified game players
SELECT 
    u.name as player_name,
    u.account_type,
    u.jersey_number,
    g.team_name,
    g.opponent_team,
    g.game_date,
    gp.is_starter
FROM game_players gp
JOIN "user" u ON gp.unified_user_id = u.id
JOIN games g ON gp.game_id = g.id
WHERE u.account_type = 'manual'
ORDER BY g.game_date DESC, u.name
LIMIT 10;

-- Verify no orphaned references
SELECT 
    'Total game_players' as metric,
    COUNT(*) as count
FROM game_players
UNION ALL
SELECT 
    'With unified_user_id' as metric,
    COUNT(*) as count
FROM game_players
WHERE unified_user_id IS NOT NULL
UNION ALL
SELECT 
    'Valid unified references' as metric,
    COUNT(*) as count
FROM game_players gp
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = gp.unified_user_id);
*/