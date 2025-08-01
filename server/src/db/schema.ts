import { pgTable, uuid, varchar, text, integer, boolean, timestamp, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Better Auth tables - extended with profile fields
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  
  // Profile fields integrated into user table
  avatarUrl: varchar('avatar_url', { length: 500 }),
  totalPoints: integer('total_points').default(0).notNull(),
  role: varchar('role', { length: 20 }).default('player').notNull(), // 'parent' | 'player' - functional roles
  isAdmin: boolean('is_admin').default(false).notNull(), // Platform admin permissions
  isOnboarded: boolean('is_onboarded').default(false).notNull(),
  isVerified: boolean('isverified').default(false).notNull(),
  jerseyNumber: integer('jersey_number'),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  ipAddress: varchar('ipAddress', { length: 255 }),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: varchar('providerId', { length: 255 }).notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: varchar('password', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});


// Workouts table
export const workouts = pgTable('workouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  exerciseType: varchar('exercise_type', { length: 50 }).notNull(), // 'dribbling' | 'shooting' | 'conditioning'
  pointsEarned: integer('points_earned').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Posts table
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  content: text('content'),
  imageUrl: varchar('image_url', { length: 500 }),
  mediaId: uuid('media_id'), // Reference to media_uploads table
  workoutId: uuid('workout_id'),
  gameId: uuid('game_id'), // Reference to games table for shared games
  postType: varchar('post_type', { length: 20 }).default('text').notNull(), // 'text', 'workout', 'game'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Likes table
export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Comments table
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Teams table for group chat channels
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Team membership table
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'admin' | 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// Chat messages table (supports both team and DM)
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: varchar('sender_id', { length: 255 }).notNull(),
  teamId: uuid('team_id'), // NULL for DMs
  recipientId: varchar('recipient_id', { length: 255 }), // NULL for team messages
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).default('text').notNull(), // 'text' | 'image' | 'system'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Parent-Child relationships table
export const parentChildRelations = pgTable('parent_child_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: varchar('parent_id', { length: 255 }).notNull(),
  childId: varchar('child_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(), // Who created this relationship (admin)
});

// Invite system tables
export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  maxUses: integer('max_uses').default(1).notNull(),
  usedCount: integer('used_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const inviteRegistrations = pgTable('invite_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  inviteCodeId: uuid('invite_code_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
});

export const accessRequests = pgTable('access_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  message: text('message'),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
});

export const emailWhitelist = pgTable('email_whitelist', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  addedBy: varchar('added_by', { length: 255 }).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const bannedEmails = pgTable('banned_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  bannedBy: varchar('banned_by', { length: 255 }).notNull(),
  bannedAt: timestamp('banned_at').defaultNow().notNull(),
  reason: text('reason'),
});

// Games table for basketball game schedule
export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamName: varchar('team_name', { length: 255 }).notNull(),
  isHome: boolean('is_home').notNull(),
  opponentTeam: varchar('opponent_team', { length: 255 }).notNull(),
  gameDate: timestamp('game_date').notNull(),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  notes: text('notes'), // Game notes/description
  status: varchar('status', { length: 20 }).default('upcoming').notNull(), // 'upcoming' | 'live' | 'completed'
  isSharedToFeed: boolean('is_shared_to_feed').default(false).notNull(), // Track if shared to social feed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Game comments table (separate from regular posts)
export const gameComments = pgTable('game_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Media uploads table for tracking all uploaded content
export const mediaUploads = pgTable('media_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(), // Size in bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  mediaType: varchar('media_type', { length: 20 }).notNull(), // 'image' | 'video'
  uploadUrl: varchar('upload_url', { length: 1000 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 1000 }), // For videos
  width: integer('width'), // Media dimensions
  height: integer('height'),
  duration: integer('duration'), // For videos, in seconds
  tags: text('tags'), // JSON array of tags for admin filtering
  description: text('description'), // Optional description
  isVisible: boolean('is_visible').default(true).notNull(), // Admin can hide content
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const userRelations = relations(user, ({ many, one }) => ({
  workouts: many(workouts),
  posts: many(posts),
  likes: many(likes),
  comments: many(comments),
  sessions: many(session),
  accounts: many(account),
  teamMemberships: many(teamMembers),
  createdTeams: many(teams),
  sentMessages: many(chatMessages, { relationName: 'sender' }),
  receivedMessages: many(chatMessages, { relationName: 'recipient' }),
  // New parent-child relationships
  parentRelationships: many(parentChildRelations, { relationName: 'parent' }),
  childRelationships: many(parentChildRelations, { relationName: 'child' }),
  // Game comments
  gameComments: many(gameComments),
  // Media uploads
  mediaUploads: many(mediaUploads),
  // Reports
  reportsMade: many(reports, { relationName: 'reporter' }),
  reportsResolved: many(reports, { relationName: 'resolver' }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(user, {
    fields: [workouts.userId],
    references: [user.id],
  }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(user, {
    fields: [posts.userId],
    references: [user.id],
  }),
  workout: one(workouts, {
    fields: [posts.workoutId],
    references: [workouts.id],
  }),
  media: one(mediaUploads, {
    fields: [posts.mediaId],
    references: [mediaUploads.id],
  }),
  game: one(games, {
    fields: [posts.gameId],
    references: [games.id],
  }),
  likes: many(likes),
  comments: many(comments),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  post: one(posts, {
    fields: [likes.postId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [likes.userId],
    references: [user.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [comments.userId],
    references: [user.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  creator: one(user, {
    fields: [teams.createdBy],
    references: [user.id],
  }),
  members: many(teamMembers),
  messages: many(chatMessages),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [teamMembers.userId],
    references: [user.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  sender: one(user, {
    fields: [chatMessages.senderId],
    references: [user.id],
    relationName: 'sender',
  }),
  recipient: one(user, {
    fields: [chatMessages.recipientId],
    references: [user.id],
    relationName: 'recipient',
  }),
  team: one(teams, {
    fields: [chatMessages.teamId],
    references: [teams.id],
  }),
}));

export const parentChildRelationsRelations = relations(parentChildRelations, ({ one }) => ({
  parent: one(user, {
    fields: [parentChildRelations.parentId],
    references: [user.id],
    relationName: 'parent',
  }),
  child: one(user, {
    fields: [parentChildRelations.childId],
    references: [user.id],
    relationName: 'child',
  }),
  creator: one(user, {
    fields: [parentChildRelations.createdBy],
    references: [user.id],
  }),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  comments: many(gameComments),
  players: many(gamePlayers),
  activities: many(gameActivities),
}));

export const gameCommentsRelations = relations(gameComments, ({ one }) => ({
  game: one(games, {
    fields: [gameComments.gameId],
    references: [games.id],
  }),
  user: one(user, {
    fields: [gameComments.userId],
    references: [user.id],
  }),
}));

export const mediaUploadsRelations = relations(mediaUploads, ({ one, many }) => ({
  uploader: one(user, {
    fields: [mediaUploads.uploadedBy],
    references: [user.id],
  }),
  posts: many(posts),
}));

// Reports table for content moderation
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportedBy: varchar('reported_by', { length: 255 }).notNull(),
  reportType: varchar('report_type', { length: 20 }).notNull(), // 'post' | 'media'
  reportedItemId: uuid('reported_item_id').notNull(), // Post ID or Media ID
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'resolved' | 'dismissed'
  adminNotes: text('admin_notes'),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(user, {
    fields: [reports.reportedBy],
    references: [user.id],
  }),
  resolver: one(user, {
    fields: [reports.resolvedBy],
    references: [user.id],
  }),
}));

// Game Players - players participating in specific games
export const gamePlayers = pgTable('game_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull(),
  userId: varchar('user_id', { length: 255 }), // NULL for manual players
  manualPlayerId: uuid('manual_player_id'), // Reference to manual_players table
  jerseyNumber: integer('jersey_number'),
  isStarter: boolean('is_starter').default(false).notNull(),
  minutesPlayed: integer('minutes_played').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Manual Players - for players not yet registered in the system
export const manualPlayers = pgTable('manual_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  jerseyNumber: integer('jersey_number'),
  linkedUserId: varchar('linked_user_id', { length: 255 }), // Admin can link to registered user
  linkedBy: varchar('linked_by', { length: 255 }), // Admin who made the link
  linkedAt: timestamp('linked_at'),
  notes: text('notes'), // Additional notes about the player
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Game Stats - individual player statistics for games
export const gameStats = pgTable('game_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull(),
  gamePlayerId: uuid('game_player_id').notNull(), // Reference to game_players
  statType: varchar('stat_type', { length: 20 }).notNull(), // '2pt', '3pt', '1pt', 'steal', 'rebound'
  value: integer('value').default(1).notNull(), // Usually 1, but could be different for points
  quarter: integer('quarter'), // Optional - which quarter/period
  timeMinute: integer('time_minute'), // Optional - minute mark when stat occurred
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(), // Admin who recorded the stat
});

// Game Activity Log - comprehensive log of all game activities
export const gameActivities = pgTable('game_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull(),
  activityType: varchar('activity_type', { length: 30 }).notNull(), // 'stat_added', 'stat_removed', 'player_added', 'player_removed', 'game_updated'
  description: text('description').notNull(), // Human-readable description
  metadata: text('metadata'), // JSON metadata for the activity
  performedBy: varchar('performed_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id],
  }),
  user: one(user, {
    fields: [gamePlayers.userId],
    references: [user.id],
  }),
  manualPlayer: one(manualPlayers, {
    fields: [gamePlayers.manualPlayerId],
    references: [manualPlayers.id],
  }),
}));

export const manualPlayersRelations = relations(manualPlayers, ({ one }) => ({
  linkedUser: one(user, {
    fields: [manualPlayers.linkedUserId],
    references: [user.id],
  }),
  linker: one(user, {
    fields: [manualPlayers.linkedBy],
    references: [user.id],
  }),
}));

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
  game: one(games, {
    fields: [gameStats.gameId],
    references: [games.id],
  }),
  gamePlayer: one(gamePlayers, {
    fields: [gameStats.gamePlayerId],
    references: [gamePlayers.id],
  }),
  createdByUser: one(user, {
    fields: [gameStats.createdBy],
    references: [user.id],
  }),
}));

export const gameActivitiesRelations = relations(gameActivities, ({ one }) => ({
  game: one(games, {
    fields: [gameActivities.gameId],
    references: [games.id],
  }),
  performedByUser: one(user, {
    fields: [gameActivities.performedBy],
    references: [user.id],
  }),
}));