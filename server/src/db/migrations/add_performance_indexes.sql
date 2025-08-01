-- Performance Indexes Migration
-- Date: 2025-01-31
-- IMPORTANT: This migration only ADDS indexes - NO DATA IS DROPPED OR MODIFIED

-- ============================================================================
-- AUTHENTICATION & SESSION INDEXES (Critical for Better Auth performance)
-- ============================================================================

-- 1. User email lookup (most frequent auth query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email ON "user"(email);

-- 2. Session token lookup (every authenticated request)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_token ON "session"(token);

-- 3. Session by user and expiration (session cleanup and user lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_user_expires ON "session"(userId, expiresAt);

-- 4. User role lookups (for role-based permissions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role ON "user"(role);

-- 5. Admin user lookups (for admin permission checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_admin ON "user"(is_admin) WHERE is_admin = true;

-- 6. User verification status (for verified user queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_verified ON "user"(isverified);

-- ============================================================================
-- BETTER AUTH SPECIFIC INDEXES
-- ============================================================================

-- 7. Account by user (for Better Auth account linking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_user ON "account"(userId);

-- 8. Account by provider (for OAuth provider lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_provider ON "account"(providerId, accountId);

-- 9. Verification by identifier (for email verification)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_identifier ON "verification"(identifier);

-- 10. Verification by expiration (for cleanup jobs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_expires ON "verification"(expiresAt);

-- ============================================================================
-- APPLICATION PERFORMANCE INDEXES
-- ============================================================================

-- 11. Posts by user (user profile views, my posts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_user ON "posts"(userId);

-- 12. Posts by creation date (feed queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_created ON "posts"(created_at DESC);

-- 13. Posts by user and date (optimized user timeline)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_user_date ON "posts"(userId, created_at DESC);

-- 14. Workouts by user (user fitness tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workouts_user ON "workouts"(user_id);

-- 15. Workouts by user and date (user workout history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workouts_user_date ON "workouts"(user_id, created_at DESC);

-- 16. Likes by post (like count queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_post ON "likes"(post_id);

-- 17. Likes by user (user activity tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_user ON "likes"(user_id);

-- 18. Comments by post (comment loading)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post ON "comments"(post_id);

-- 19. Comments by post and date (chronological comments)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_date ON "comments"(post_id, created_at DESC);

-- ============================================================================
-- GAMES & SPORTS PERFORMANCE INDEXES
-- ============================================================================

-- 20. Games by date (game schedule views)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_date ON "games"(gameDate);

-- 21. Game players by game (roster queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_players_game ON "game_players"(gameId);

-- 22. Game players by user (player game history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_players_user ON "game_players"(userId);

-- 23. Game stats by game player (player statistics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_stats_player ON "game_stats"(gamePlayerId);

-- 24. Game stats by game (game statistics aggregation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_stats_game ON "game_stats"(gameId);

-- ============================================================================
-- PARENT-CHILD RELATIONSHIP INDEXES
-- ============================================================================

-- 25. Parent-child by parent (parent dashboard queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_child_parent ON "parent_child_relations"(parentId);

-- 26. Parent-child by child (child lookup queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_child_child ON "parent_child_relations"(childId);

-- ============================================================================
-- ADMIN & INVITE SYSTEM INDEXES
-- ============================================================================

-- 27. Invite codes by code (invite validation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invite_codes_code ON "invite_codes"(code);

-- 28. Invite codes by active status (active invite queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invite_codes_active ON "invite_codes"(isActive) WHERE isActive = true;

-- 29. Access requests by email (duplicate request checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_requests_email ON "access_requests"(email);

-- 30. Email whitelist by email (whitelist checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_whitelist ON "email_whitelist"(email);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- 31. User search optimization (name + email search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_search ON "user"(name, email);

-- 32. Active sessions (non-expired sessions by user)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sessions ON "session"(userId, expiresAt) WHERE expiresAt > NOW();

-- 33. Leaderboard optimization (points ranking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_points ON "user"(total_points DESC);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify critical indexes were created
SELECT 
    indexname, 
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('user', 'session', 'account') 
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Show index sizes for monitoring
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexname::regclass) DESC;

ANALYZE;