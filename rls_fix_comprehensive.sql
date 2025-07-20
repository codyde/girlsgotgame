-- COMPREHENSIVE RLS FIX - Run this in Supabase SQL Editor
-- This will completely reset and fix the profiles table permissions

-- 1. First, let's check what policies exist
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 2. Disable RLS temporarily to reset everything
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;  
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON profiles;

-- 4. Grant basic permissions to authenticated role
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 5. Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create simple, working policies
CREATE POLICY "Allow authenticated users to read own profile" 
ON profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to insert own profile" 
ON profiles FOR INSERT 
TO authenticated  
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 7. Also allow anon users during OAuth flow (temporary tokens)
CREATE POLICY "Allow anon users to read profiles during auth" 
ON profiles FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Allow anon users to insert profiles during auth" 
ON profiles FOR INSERT 
TO anon
WITH CHECK (true);

-- 8. Verify the setup
-- You should see these policies:
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'profiles';

-- 9. Test query (replace with your actual user ID)
-- SELECT * FROM profiles WHERE id = auth.uid();