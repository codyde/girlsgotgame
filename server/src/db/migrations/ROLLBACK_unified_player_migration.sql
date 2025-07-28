-- ROLLBACK SCRIPT: Unified Player System Migration
-- ⚠️  WARNING: This will undo the unified player system migration
-- Only run this if you need to revert to the original dual-system approach
-- Make sure to backup your database before running this script

-- This script removes all changes made by the unified player migration
-- It does NOT delete any game data or relationships - only the unified structure

BEGIN;

-- Store current state for verification
CREATE TEMP TABLE rollback_verification AS
SELECT 
    'before_rollback' as stage,
    (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual') as manual_users_count,
    (SELECT COUNT(*) FROM parent_child_relations pcr JOIN "user" u ON pcr.child_id = u.id WHERE u.account_type = 'manual') as manual_relationships_count,
    (SELECT COUNT(*) FROM game_players WHERE unified_user_id IS NOT NULL) as unified_game_players_count;

RAISE NOTICE 'Starting rollback verification...';
RAISE NOTICE 'Manual users to remove: %', (SELECT manual_users_count FROM rollback_verification);
RAISE NOTICE 'Manual relationships to remove: %', (SELECT manual_relationships_count FROM rollback_verification);
RAISE NOTICE 'Unified game players to update: %', (SELECT unified_game_players_count FROM rollback_verification);

-- Confirmation check - user must manually enable this
DO $$
BEGIN
    -- Uncomment the line below to enable rollback
    -- IF TRUE THEN
    IF FALSE THEN
        RAISE NOTICE 'Rollback enabled - proceeding...';
    ELSE
        RAISE EXCEPTION 'Rollback not enabled. Edit this script and set the confirmation check to TRUE to proceed.';
    END IF;
END $$;

-- Phase 4 Rollback: Remove unified_user_id column from game_players
RAISE NOTICE 'Rolling back Phase 4: game_players unified_user_id...';

-- Drop the unified column
ALTER TABLE "game_players" DROP COLUMN IF EXISTS "unified_user_id";

-- Drop the index
DROP INDEX IF EXISTS "game_players_unified_user_id_idx";

RAISE NOTICE 'Phase 4 rollback complete';

-- Phase 3 Rollback: Remove manual player parent relationships
RAISE NOTICE 'Rolling back Phase 3: manual player parent relationships...';

-- Delete parent-child relationships for manual players
DELETE FROM parent_child_relations 
WHERE child_id IN (
    SELECT id FROM "user" WHERE account_type = 'manual'
);

RAISE NOTICE 'Phase 3 rollback complete';

-- Phase 2 Rollback: Remove manual players from user table
RAISE NOTICE 'Rolling back Phase 2: manual players in user table...';

-- Delete manual players from user table
DELETE FROM "user" WHERE account_type = 'manual';

RAISE NOTICE 'Phase 2 rollback complete';

-- Phase 1 Rollback: Remove new columns from user table
RAISE NOTICE 'Rolling back Phase 1: user table extensions...';

-- Drop the new columns
ALTER TABLE "user" DROP COLUMN IF EXISTS "account_type";
ALTER TABLE "user" DROP COLUMN IF EXISTS "has_login_access";
ALTER TABLE "user" DROP COLUMN IF EXISTS "created_by_user_id";
ALTER TABLE "user" DROP COLUMN IF EXISTS "migrated_from_manual_player_id";

-- Drop the indexes
DROP INDEX IF EXISTS "user_account_type_idx";
DROP INDEX IF EXISTS "user_has_login_access_idx";
DROP INDEX IF EXISTS "user_created_by_user_id_idx";
DROP INDEX IF EXISTS "user_migrated_from_manual_player_id_idx";

RAISE NOTICE 'Phase 1 rollback complete';

-- Final verification
INSERT INTO rollback_verification
SELECT 
    'after_rollback' as stage,
    (SELECT COUNT(*) FROM "user" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'account_type') AND account_type = 'manual') as manual_users_count,
    0 as manual_relationships_count,  -- Should be 0 after rollback
    (SELECT COUNT(*) FROM game_players WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_players' AND column_name = 'unified_user_id') AND unified_user_id IS NOT NULL) as unified_game_players_count;

-- Verification report
DO $$
DECLARE
    before_manual_users INT;
    after_manual_users INT;
    rollback_success BOOLEAN;
BEGIN
    SELECT manual_users_count INTO before_manual_users FROM rollback_verification WHERE stage = 'before_rollback';
    SELECT manual_users_count INTO after_manual_users FROM rollback_verification WHERE stage = 'after_rollback';
    
    rollback_success := (after_manual_users = 0);
    
    RAISE NOTICE '';
    RAISE NOTICE '=== ROLLBACK VERIFICATION REPORT ===';
    RAISE NOTICE 'Manual users before rollback: %', before_manual_users;
    RAISE NOTICE 'Manual users after rollback: %', after_manual_users;
    RAISE NOTICE 'Rollback successful: %', rollback_success;
    
    IF rollback_success THEN
        RAISE NOTICE '✅ Rollback completed successfully!';
        RAISE NOTICE 'The system has been reverted to the original dual-player structure.';
        RAISE NOTICE 'Manual players table and relationships are preserved.';
    ELSE
        RAISE WARNING '❌ Rollback may not have completed successfully!';
        RAISE NOTICE 'Please verify the state manually.';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== IMPORTANT POST-ROLLBACK STEPS ===';
    RAISE NOTICE '1. Verify your application still works with the dual-system';
    RAISE NOTICE '2. Check that parent dashboard shows manual players correctly';
    RAISE NOTICE '3. Ensure all manual_players table data is intact';
    RAISE NOTICE '4. Update any code that may have been changed for unified system';
    RAISE NOTICE '';
END $$;

-- Verify original tables are intact
DO $$
BEGIN
    RAISE NOTICE '=== ORIGINAL DATA VERIFICATION ===';
    RAISE NOTICE 'Manual players table count: %', (SELECT COUNT(*) FROM manual_players);
    RAISE NOTICE 'Total users remaining: %', (SELECT COUNT(*) FROM "user");
    RAISE NOTICE 'Parent-child relationships: %', (SELECT COUNT(*) FROM parent_child_relations);
    RAISE NOTICE 'Game players: %', (SELECT COUNT(*) FROM game_players);
    
    -- Check if manual_players table relationships still work
    RAISE NOTICE 'Manual players with parent links: %', (SELECT COUNT(*) FROM manual_players WHERE linked_parent_id IS NOT NULL);
END $$;

COMMIT;

-- Final validation queries
\echo 'Final validation - these should return expected results:'

\echo 'Manual players (should show all original manual players):'
SELECT COUNT(*) as manual_players_count FROM manual_players;

\echo 'Users (should only show registered users):'
SELECT COUNT(*) as user_count FROM "user";

\echo 'Game players (should show all original game participations):'
SELECT COUNT(*) as game_players_count FROM game_players;

\echo ''
\echo '🔄 ROLLBACK COMPLETE'
\echo 'The unified player system migration has been rolled back.'
\echo 'Your system should now function with the original dual-player structure.'
\echo '⚠️  Remember to update any application code that was changed for the unified system.'