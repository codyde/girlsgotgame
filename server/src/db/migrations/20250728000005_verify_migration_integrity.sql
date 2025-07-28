-- Comprehensive Migration Verification Script
-- Run this after all phases to verify data integrity
-- This script is READ-ONLY and safe to run multiple times

-- Create a comprehensive report
DO $$
DECLARE
    report_line TEXT;
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'UNIFIED PLAYER SYSTEM MIGRATION VERIFICATION';
    RAISE NOTICE '==============================================';
    
    -- Overall summary
    RAISE NOTICE '';
    RAISE NOTICE '1. OVERALL SUMMARY:';
    RAISE NOTICE '   Total users: %', (SELECT COUNT(*) FROM "user");
    RAISE NOTICE '   - Registered users: %', (SELECT COUNT(*) FROM "user" WHERE account_type = 'registered');
    RAISE NOTICE '   - Manual users: %', (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual');
    RAISE NOTICE '   Manual players (original): %', (SELECT COUNT(*) FROM manual_players);
    RAISE NOTICE '   Parent-child relationships: %', (SELECT COUNT(*) FROM parent_child_relations);
    RAISE NOTICE '   Game participations: %', (SELECT COUNT(*) FROM game_players);
    
    -- Data consistency checks
    RAISE NOTICE '';
    RAISE NOTICE '2. DATA CONSISTENCY CHECKS:';
    
    -- Check 1: All manual players copied to user table
    IF (SELECT COUNT(*) FROM manual_players) = (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual') THEN
        RAISE NOTICE '   ✅ All manual players copied to user table';
    ELSE
        RAISE WARNING '   ❌ Manual player count mismatch!';
        RAISE NOTICE '      Manual players: %, Manual users: %', 
            (SELECT COUNT(*) FROM manual_players),
            (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual');
    END IF;
    
    -- Check 2: All manual player relationships copied
    IF (SELECT COUNT(*) FROM manual_players WHERE linked_parent_id IS NOT NULL) <= 
       (SELECT COUNT(*) FROM parent_child_relations pcr 
        JOIN "user" u ON pcr.child_id = u.id 
        WHERE u.account_type = 'manual') THEN
        RAISE NOTICE '   ✅ All manual player relationships preserved';
    ELSE
        RAISE WARNING '   ❌ Manual player relationships missing!';
    END IF;
    
    -- Check 3: All game players have unified IDs
    IF (SELECT COUNT(*) FROM game_players) = (SELECT COUNT(*) FROM game_players WHERE unified_user_id IS NOT NULL) THEN
        RAISE NOTICE '   ✅ All game players have unified user IDs';
    ELSE
        RAISE WARNING '   ❌ Some game players missing unified user IDs!';
        RAISE NOTICE '      Total: %, With unified ID: %',
            (SELECT COUNT(*) FROM game_players),
            (SELECT COUNT(*) FROM game_players WHERE unified_user_id IS NOT NULL);
    END IF;
    
    -- Check 4: All unified user IDs are valid
    IF NOT EXISTS (
        SELECT 1 FROM game_players gp 
        WHERE gp.unified_user_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = gp.unified_user_id)
    ) THEN
        RAISE NOTICE '   ✅ All unified user ID references are valid';
    ELSE
        RAISE WARNING '   ❌ Found invalid unified user ID references!';
    END IF;
    
END $$;

-- Detailed reports
\echo ''
\echo '3. DETAILED REPORTS:'
\echo ''

\echo '3a. User Account Types:'
SELECT 
    account_type,
    has_login_access,
    COUNT(*) as count,
    string_agg(DISTINCT role, ', ') as roles
FROM "user"
GROUP BY account_type, has_login_access
ORDER BY account_type, has_login_access;

\echo ''
\echo '3b. Parent-Child Relationships by Type:'
SELECT 
    u_parent.account_type as parent_type,
    u_child.account_type as child_type,
    COUNT(*) as relationship_count
FROM parent_child_relations pcr
JOIN "user" u_parent ON pcr.parent_id = u_parent.id
JOIN "user" u_child ON pcr.child_id = u_child.id
GROUP BY u_parent.account_type, u_child.account_type
ORDER BY u_parent.account_type, u_child.account_type;

\echo ''
\echo '3c. Game Participation by Player Type:'
SELECT 
    u.account_type as player_type,
    COUNT(*) as game_participations,
    COUNT(DISTINCT u.id) as unique_players,
    COUNT(DISTINCT gp.game_id) as unique_games
FROM game_players gp
JOIN "user" u ON gp.unified_user_id = u.id
GROUP BY u.account_type
ORDER BY u.account_type;

\echo ''
\echo '3d. Sample Manual Players with Relationships:'
SELECT 
    u_child.name as player_name,
    u_child.jersey_number,
    u_parent.email as parent_email,
    (SELECT COUNT(*) FROM game_players gp WHERE gp.unified_user_id = u_child.id) as games_played
FROM parent_child_relations pcr
JOIN "user" u_child ON pcr.child_id = u_child.id
JOIN "user" u_parent ON pcr.parent_id = u_parent.id
WHERE u_child.account_type = 'manual'
ORDER BY u_parent.email, u_child.name
LIMIT 10;

\echo ''
\echo '3e. Data Integrity Checks:'

-- Check for orphaned records
SELECT 'Orphaned game_players' as check_type, COUNT(*) as count
FROM game_players gp
WHERE gp.unified_user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = gp.unified_user_id)

UNION ALL

SELECT 'Game_players without unified_user_id' as check_type, COUNT(*) as count
FROM game_players
WHERE unified_user_id IS NULL

UNION ALL

SELECT 'Parent_child_relations with invalid parent' as check_type, COUNT(*) as count
FROM parent_child_relations pcr
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = pcr.parent_id AND u.role = 'parent')

UNION ALL

SELECT 'Parent_child_relations with invalid child' as check_type, COUNT(*) as count
FROM parent_child_relations pcr
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = pcr.child_id)

ORDER BY count DESC;

\echo ''
\echo '3f. Migration Audit Trail:'
SELECT 
    'Manual players migrated' as metric,
    COUNT(*) as count
FROM "user"
WHERE migrated_from_manual_player_id IS NOT NULL

UNION ALL

SELECT 
    'Manual players with creators tracked' as metric,
    COUNT(*) as count
FROM "user"
WHERE account_type = 'manual' AND created_by_user_id IS NOT NULL

UNION ALL

SELECT 
    'Users with login access' as metric,
    COUNT(*) as count
FROM "user"
WHERE has_login_access = true

UNION ALL

SELECT 
    'Users without login access' as metric,
    COUNT(*) as count
FROM "user"
WHERE has_login_access = false;

\echo ''
\echo '==============================================';
\echo 'MIGRATION VERIFICATION COMPLETE';
\echo 'Review the above reports for any issues.';
\echo 'All counts should match between old and new systems.';
\echo '==============================================';

-- Final validation query - should return no rows if everything is perfect
\echo ''
\echo 'Final Validation (should return no issues):'

SELECT 'ISSUE' as status, 'Manual player count mismatch' as description
WHERE (SELECT COUNT(*) FROM manual_players) != (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual')

UNION ALL

SELECT 'ISSUE' as status, 'Game players without unified ID' as description
WHERE EXISTS (SELECT 1 FROM game_players WHERE unified_user_id IS NULL)

UNION ALL

SELECT 'ISSUE' as status, 'Invalid unified user ID references' as description
WHERE EXISTS (
    SELECT 1 FROM game_players gp 
    WHERE gp.unified_user_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = gp.unified_user_id)
)

UNION ALL

SELECT 'ISSUE' as status, 'Orphaned parent-child relationships' as description
WHERE EXISTS (
    SELECT 1 FROM parent_child_relations pcr
    WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = pcr.parent_id)
    OR NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = pcr.child_id)
);

-- If no issues found, show success message
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 WHERE (SELECT COUNT(*) FROM manual_players) != (SELECT COUNT(*) FROM "user" WHERE account_type = 'manual')
        OR EXISTS (SELECT 1 FROM game_players WHERE unified_user_id IS NULL)
        OR EXISTS (SELECT 1 FROM game_players gp WHERE gp.unified_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = gp.unified_user_id))
        OR EXISTS (SELECT 1 FROM parent_child_relations pcr WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = pcr.parent_id) OR NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = pcr.child_id))
    ) THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SUCCESS: All migration integrity checks passed!';
        RAISE NOTICE 'The unified player system is ready for use.';
    END IF;
END $$;