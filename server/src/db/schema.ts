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
  role: varchar('role', { length: 20 }).default('player').notNull(), // 'parent' | 'player'
  childId: varchar('child_id', { length: 255 }),
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
  content: text('content').notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  workoutId: uuid('workout_id'),
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
  child: one(user, {
    fields: [user.childId],
    references: [user.id],
  }),
  // New parent-child relationships
  parentRelationships: many(parentChildRelations, { relationName: 'parent' }),
  childRelationships: many(parentChildRelations, { relationName: 'child' }),
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