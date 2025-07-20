-- FIX PROFILES TABLE RLS SPECIFICALLY
-- This addresses the database connectivity test failures and auth timeout issues

-- 1. Check current profiles RLS status
SELECT 
    'Current Profiles RLS' as check_type,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles';

-- 2. Check current profiles policies
SELECT 
    'Current Profiles Policies' as check_type,
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 3. TEMPORARY: Disable RLS on profiles table for testing
-- This will help us confirm if RLS is the issue
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 4. Grant explicit permissions
GRANT ALL PRIVILEGES ON profiles TO authenticated;
GRANT ALL PRIVILEGES ON profiles TO anon;
GRANT ALL PRIVILEGES ON profiles TO postgres;
GRANT ALL PRIVILEGES ON profiles TO service_role;

-- 5. Test query that should work now
SELECT 'Test Query' as test_type, count(*) as profile_count FROM profiles;

-- 6. Check final status
SELECT 
    'Final Profiles RLS Status' as check_type,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles';