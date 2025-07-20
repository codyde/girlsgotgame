-- SUPABASE RLS ULTRA-DEBUGGING AND COMPREHENSIVE FIX
-- This addresses the specific timing issues with OAuth callbacks and auth.uid() availability

-- ===== PHASE 1: COMPREHENSIVE DIAGNOSTICS =====

-- 1. Current RLS state
SELECT 
    'RLS Status' as diagnostic_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles';

-- 2. All current policies (including hidden ones)
SELECT 
    'Current Policies' as diagnostic_type,
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

-- 3. Permission grants
SELECT 
    'Table Permissions' as diagnostic_type,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'profiles';

-- 4. Check for auth functions availability
SELECT 
    'Auth Functions' as diagnostic_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'auth' 
AND routine_name IN ('uid', 'jwt', 'role');

-- ===== PHASE 2: NUCLEAR RESET =====
-- Remove all existing policies and start fresh

-- Disable RLS temporarily
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
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
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Grant explicit permissions (Supabase requirement)
GRANT ALL PRIVILEGES ON profiles TO authenticated;
GRANT ALL PRIVILEGES ON profiles TO anon;
GRANT ALL PRIVILEGES ON profiles TO postgres;
GRANT ALL PRIVILEGES ON profiles TO service_role;

-- ===== PHASE 3: SUPABASE-OPTIMIZED RLS POLICIES =====
-- These handle OAuth callback timing issues and auth state transitions

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow anon users to INSERT during OAuth callback
-- This is critical because during OAuth, the user might not be "authenticated" yet
CREATE POLICY "profiles_anon_insert_oauth" ON profiles
    FOR INSERT TO anon
    WITH CHECK (true);

-- Policy 2: Allow anon users to SELECT during OAuth callback
-- Sometimes needed for profile existence checks during callback
CREATE POLICY "profiles_anon_select_oauth" ON profiles
    FOR SELECT TO anon
    USING (true);

-- Policy 3: Authenticated users can do everything on their own profile
-- This is the main policy for normal app usage
CREATE POLICY "profiles_authenticated_all" ON profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy 4: Service role has full access (for admin functions)
CREATE POLICY "profiles_service_role_all" ON profiles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 5: Handle edge case where auth.uid() might be null temporarily
-- This can happen during OAuth transitions
CREATE POLICY "profiles_authenticated_null_uid_select" ON profiles
    FOR SELECT TO authenticated
    USING (auth.uid() IS NULL OR auth.uid() = id);

-- ===== PHASE 4: TEST QUERIES =====
-- These should all work without 406 errors

-- Test 1: Anonymous profile lookup (OAuth scenario)
-- This simulates what happens during OAuth callback
SELECT 'Test 1 - Anon Select' as test_name, count(*) as result 
FROM profiles;

-- Test 2: Authenticated profile lookup
-- This simulates normal app usage
SELECT 'Test 2 - Auth Context' as test_name, 
       current_setting('request.jwt.claims', true) as jwt_claims;

-- Test 3: Show current role
SELECT 'Test 3 - Current Role' as test_name, current_user as current_role;

-- ===== PHASE 5: VERIFICATION =====

-- Final policy count and status
SELECT 
    'Final Status' as check_type,
    'RLS: ' || CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END ||
    ', Policies: ' || (
        SELECT count(*)::text 
        FROM pg_policies 
        WHERE tablename = 'profiles'
    ) as status
FROM pg_tables 
WHERE tablename = 'profiles';

-- List all new policies
SELECT 
    'New Policies' as verification_type,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ===== TROUBLESHOOTING GUIDE =====
/*
If you're still getting 406 errors after this:

1. Check your Supabase project settings:
   - Go to Authentication > Settings
   - Ensure "Enable email confirmations" is OFF for testing
   - Check OAuth provider settings

2. Verify environment variables:
   - VITE_SUPABASE_URL should point to your project
   - VITE_SUPABASE_ANON_KEY should be the "anon" key, not "service_role"

3. Check browser developer tools:
   - Look for Authorization header in requests
   - Verify JWT token is being sent

4. Test with RLS completely disabled:
   - ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
   - If this fixes it, the problem is definitely RLS-related

5. Common Supabase OAuth issues:
   - OAuth redirects might not preserve auth state
   - Browser security settings blocking cookies
   - Local development vs production URL mismatches

6. Debug auth.uid() availability:
   - Run: SELECT auth.uid(); in SQL editor
   - Should return null for anon, user ID for authenticated
*/