-- COMPREHENSIVE RLS DIAGNOSTIC FOR ALL TABLES
-- Check RLS status and policies across the entire database

-- ===== RLS STATUS FOR ALL TABLES =====
SELECT 
    'RLS Status' as diagnostic_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ===== ALL POLICIES ACROSS ALL TABLES =====
SELECT 
    'All Policies' as diagnostic_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ===== TABLE PERMISSIONS FOR ALL TABLES =====
SELECT 
    'Table Permissions' as diagnostic_type,
    table_name,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_schema = 'public'
AND table_name IN ('comments', 'likes', 'posts', 'profiles', 'workouts')
ORDER BY table_name, grantee;

-- ===== SPECIFIC CHECK FOR EACH TABLE =====

-- Comments table
SELECT 'Comments RLS' as check_type, rowsecurity as enabled
FROM pg_tables WHERE tablename = 'comments';

-- Likes table  
SELECT 'Likes RLS' as check_type, rowsecurity as enabled
FROM pg_tables WHERE tablename = 'likes';

-- Posts table
SELECT 'Posts RLS' as check_type, rowsecurity as enabled
FROM pg_tables WHERE tablename = 'posts';

-- Profiles table
SELECT 'Profiles RLS' as check_type, rowsecurity as enabled
FROM pg_tables WHERE tablename = 'profiles';

-- Workouts table
SELECT 'Workouts RLS' as check_type, rowsecurity as enabled
FROM pg_tables WHERE tablename = 'workouts';

-- ===== COUNT POLICIES PER TABLE =====
SELECT 
    tablename,
    count(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ===== NUCLEAR RESET FOR ALL TABLES (UNCOMMENT TO RUN) =====
/*
-- Disable RLS on all tables
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE workouts DISABLE ROW LEVEL SECURITY;

-- Drop all policies on all tables
DO $$
DECLARE
    pol record;
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['comments', 'likes', 'posts', 'profiles', 'workouts'])
    LOOP
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = tbl
        LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON ' || quote_ident(tbl);
            RAISE NOTICE 'Dropped policy % on table %', pol.policyname, tbl;
        END LOOP;
    END LOOP;
END $$;

-- Grant permissions to all tables
GRANT ALL PRIVILEGES ON comments TO authenticated, anon, postgres, service_role;
GRANT ALL PRIVILEGES ON likes TO authenticated, anon, postgres, service_role;
GRANT ALL PRIVILEGES ON posts TO authenticated, anon, postgres, service_role;
GRANT ALL PRIVILEGES ON profiles TO authenticated, anon, postgres, service_role;
GRANT ALL PRIVILEGES ON workouts TO authenticated, anon, postgres, service_role;
*/