-- FIX ALL TABLES RLS FOR OAUTH FLOW
-- Add anon policies to all tables to prevent 406 errors during OAuth callback

-- ===== COMMENTS TABLE =====
-- Allow anon users to read comments (for feed display during OAuth)
CREATE POLICY "comments_anon_select" ON comments
    FOR SELECT TO anon
    USING (true);

-- ===== LIKES TABLE =====
-- Allow anon users to read likes (for feed display during OAuth)
CREATE POLICY "likes_anon_select" ON likes
    FOR SELECT TO anon
    USING (true);

-- ===== POSTS TABLE =====
-- Allow anon users to read posts (critical for feed display during OAuth)
CREATE POLICY "posts_anon_select" ON posts
    FOR SELECT TO anon
    USING (true);

-- ===== WORKOUTS TABLE =====
-- Allow anon users to read workouts (for exercise templates during OAuth)
CREATE POLICY "workouts_anon_select" ON workouts
    FOR SELECT TO anon
    USING (true);

-- ===== VERIFICATION =====
-- Check that all tables now have anon policies
SELECT 
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
AND roles @> '{anon}'
ORDER BY tablename, policyname;

-- Count policies per table
SELECT 
    tablename,
    count(*) as total_policies,
    count(*) FILTER (WHERE roles @> '{anon}') as anon_policies,
    count(*) FILTER (WHERE roles @> '{authenticated}') as auth_policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;