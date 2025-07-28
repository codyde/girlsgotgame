-- Phase 3: Copy Manual Player Parent Relationships to Unified System
-- This migration COPIES parent relationships without removing anything
-- Safe to run multiple times (idempotent)
-- Requires Phase 1 and 2 to be completed first

BEGIN;

-- Verify previous phases were completed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'account_type') THEN
        RAISE EXCEPTION 'Phase 1 migration not completed. Run phase1_extend_user_table.sql first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM "user" WHERE account_type = 'manual') THEN
        RAISE EXCEPTION 'Phase 2 migration not completed. Run phase2_copy_manual_players.sql first.';
    END IF;
END $$;

-- Store counts before migration for verification
CREATE TEMP TABLE relationship_stats AS
SELECT 
    'before_migration' as stage,
    (SELECT COUNT(*) FROM manual_players WHERE linked_parent_id IS NOT NULL) as manual_player_relationships,
    (SELECT COUNT(*) FROM parent_child_relations) as total_relationships;

-- Report before migration
DO $$
DECLARE
    mp_rels INT;
    total_rels INT;
BEGIN
    SELECT manual_player_relationships, total_relationships 
    INTO mp_rels, total_rels 
    FROM relationship_stats WHERE stage = 'before_migration';
    
    RAISE NOTICE 'Before migration - Manual player relationships: %, Total relationships: %', 
        mp_rels, total_rels;
END $$;

-- Copy manual player parent relationships to unified parent_child_relations table
INSERT INTO parent_child_relations (
    parent_id,
    child_id,
    created_by,
    created_at
)
SELECT 
    mp.linked_parent_id,           -- Parent ID (already exists in user table)
    mp.id::text,                   -- Child ID (now exists in user table from Phase 2)
    mp.linked_by,                  -- Who created this relationship
    COALESCE(mp.linked_at, mp.created_at)  -- When relationship was created
FROM manual_players mp
WHERE mp.linked_parent_id IS NOT NULL
AND NOT EXISTS (
    -- Prevent duplicates
    SELECT 1 FROM parent_child_relations pcr
    WHERE pcr.parent_id = mp.linked_parent_id 
    AND pcr.child_id = mp.id::text
);

-- Store counts after migration
INSERT INTO relationship_stats
SELECT 
    'after_migration' as stage,
    (SELECT COUNT(*) FROM manual_players WHERE linked_parent_id IS NOT NULL) as manual_player_relationships,
    (SELECT COUNT(*) FROM parent_child_relations) as total_relationships;

-- Verification and reporting
DO $$
DECLARE
    before_manual_rels INT;
    before_total_rels INT;
    after_total_rels INT;
    expected_total_rels INT;
    migration_success BOOLEAN;
BEGIN
    SELECT manual_player_relationships INTO before_manual_rels FROM relationship_stats WHERE stage = 'before_migration';
    SELECT total_relationships INTO before_total_rels FROM relationship_stats WHERE stage = 'before_migration';
    SELECT total_relationships INTO after_total_rels FROM relationship_stats WHERE stage = 'after_migration';
    
    expected_total_rels := before_total_rels + before_manual_rels;
    migration_success := (after_total_rels >= before_total_rels);
    
    RAISE NOTICE 'Phase 3 Migration Results:';
    RAISE NOTICE '  Manual player relationships: %', before_manual_rels;
    RAISE NOTICE '  Relationships before: %', before_total_rels;
    RAISE NOTICE '  Relationships after: %', after_total_rels;
    RAISE NOTICE '  New relationships added: %', after_total_rels - before_total_rels;
    RAISE NOTICE '  Migration successful: %', migration_success;
    
    IF NOT migration_success THEN
        RAISE WARNING 'Migration failed! Relationship count decreased.';
    END IF;
END $$;

-- Verify all manual player relationships were copied
DO $$
DECLARE
    missing_relationships INT;
BEGIN
    SELECT COUNT(*) INTO missing_relationships
    FROM manual_players mp
    WHERE mp.linked_parent_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM parent_child_relations pcr
        WHERE pcr.parent_id = mp.linked_parent_id 
        AND pcr.child_id = mp.id::text
    );
    
    IF missing_relationships > 0 THEN
        RAISE WARNING 'Found % manual player relationships not copied!', missing_relationships;
        
        -- Log missing relationships count only
        RAISE NOTICE 'Found % missing relationships - check manually if needed', missing_relationships;
    ELSE
        RAISE NOTICE 'All manual player relationships successfully copied!';
    END IF;
END $$;

-- Verify parent-child data integrity
DO $$
DECLARE
    orphaned_children INT;
    invalid_parents INT;
BEGIN
    -- Check for children without valid parents
    SELECT COUNT(*) INTO orphaned_children
    FROM parent_child_relations pcr
    WHERE NOT EXISTS (
        SELECT 1 FROM "user" u 
        WHERE u.id = pcr.parent_id AND u.role = 'parent'
    );
    
    -- Check for parents pointing to non-existent children
    SELECT COUNT(*) INTO invalid_parents
    FROM parent_child_relations pcr
    WHERE NOT EXISTS (
        SELECT 1 FROM "user" u 
        WHERE u.id = pcr.child_id
    );
    
    IF orphaned_children > 0 THEN
        RAISE WARNING 'Found % relationships with invalid parents!', orphaned_children;
    END IF;
    
    IF invalid_parents > 0 THEN
        RAISE WARNING 'Found % relationships with invalid children!', invalid_parents;
    END IF;
    
    IF orphaned_children = 0 AND invalid_parents = 0 THEN
        RAISE NOTICE 'All parent-child relationships are valid!';
    END IF;
END $$;

COMMIT;

-- Manual verification queries (run these after the migration)
/*
-- Check parent-child relationships for manual players
SELECT 
    u_child.name as child_name,
    u_child.account_type as child_type,
    u_child.jersey_number,
    u_parent.email as parent_email,
    u_parent.name as parent_name,
    pcr.created_at as relationship_created
FROM parent_child_relations pcr
JOIN "user" u_child ON pcr.child_id = u_child.id
JOIN "user" u_parent ON pcr.parent_id = u_parent.id
WHERE u_child.account_type = 'manual'
ORDER BY u_parent.email, u_child.name;

-- Summary by parent
SELECT 
    u_parent.email as parent_email,
    u_parent.name as parent_name,
    COUNT(*) as total_children,
    COUNT(CASE WHEN u_child.account_type = 'registered' THEN 1 END) as registered_children,
    COUNT(CASE WHEN u_child.account_type = 'manual' THEN 1 END) as manual_children
FROM parent_child_relations pcr
JOIN "user" u_child ON pcr.child_id = u_child.id
JOIN "user" u_parent ON pcr.parent_id = u_parent.id
GROUP BY u_parent.id, u_parent.email, u_parent.name
ORDER BY u_parent.email;
*/