-- COMPREHENSIVE RLS DIAGNOSTIC AND FIX
-- Run this step by step in Supabase SQL Editor

-- 1. FIRST: Check current RLS status and policies
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasoids
FROM pg_tables 
WHERE tablename = 'profiles';

-- 2. Check what policies currently exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 3. Check table permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'profiles';

-- 4. NUCLEAR OPTION: Completely reset profiles table RLS
-- (Only run if you're sure you want to reset everything)

-- Disable RLS completely
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies (even hidden ones)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON profiles';
    END LOOP;
END $$;

-- Grant full permissions to authenticated and anon
GRANT ALL PRIVILEGES ON profiles TO authenticated;
GRANT ALL PRIVILEGES ON profiles TO anon;
GRANT ALL PRIVILEGES ON profiles TO postgres;

-- Test query (should work now)
-- SELECT count(*) FROM profiles;

-- 5. OPTIONAL: Re-enable RLS with simple policies
-- (Only uncomment and run if you want RLS back on)

/*
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Simple policy: allow all operations for authenticated users on their own data
CREATE POLICY "profiles_policy_authenticated" ON profiles
    FOR ALL TO authenticated 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow anon users to read/insert during OAuth flow
CREATE POLICY "profiles_policy_anon" ON profiles
    FOR ALL TO anon 
    USING (true)
    WITH CHECK (true);
*/

-- 6. Final verification
SELECT 'RLS Status' as check_type, 
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE tablename = 'profiles'

UNION ALL

SELECT 'Policy Count' as check_type, 
    count(*)::text as status
FROM pg_policies 
WHERE tablename = 'profiles'

UNION ALL

SELECT 'Permissions' as check_type,
    string_agg(grantee || ':' || privilege_type, ', ') as status
FROM information_schema.table_privileges 
WHERE table_name = 'profiles';