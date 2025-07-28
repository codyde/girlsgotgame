import { z } from 'zod';

// Profile schemas
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  totalPoints: z.number().int().min(0),
  role: z.enum(['parent', 'player']),
  childId: z.string().uuid().nullable(),
  isOnboarded: z.boolean(),
  jerseyNumber: z.number().int().min(1).max(99).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});


export const updateProfileSchema = z.object({
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  role: z.enum(['parent', 'player']).optional(),
  childId: z.string().uuid().optional(),
  isOnboarded: z.boolean().optional(),
  jerseyNumber: z.number().int().min(1).max(99).optional(),
});

// Workout schemas
export const workoutSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  exerciseType: z.enum(['dribbling', 'shooting', 'conditioning']),
  pointsEarned: z.number().int().min(0),
  durationMinutes: z.number().int().min(1),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const createWorkoutSchema = z.object({
  exerciseType: z.enum(['dribbling', 'shooting', 'conditioning']),
  pointsEarned: z.number().int().min(0),
  durationMinutes: z.number().int().min(1),
  notes: z.string().optional(),
});

// Post schemas
export const postSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string(),
  imageUrl: z.string().url().nullable(),
  mediaId: z.string().uuid().nullable(),
  workoutId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const createPostSchema = z.object({
  content: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  mediaId: z.string().uuid().nullable().optional(),
  workoutId: z.string().uuid().nullable().optional(),
});

export const updatePostSchema = z.object({
  content: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  mediaId: z.string().uuid().optional(),
});

// Like schemas
export const likeSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string(),
});

// Comment schemas
export const commentSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1),
});

// Types
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export type Workout = z.infer<typeof workoutSchema>;
export type CreateWorkout = z.infer<typeof createWorkoutSchema>;

export type Post = z.infer<typeof postSchema>;
export type CreatePost = z.infer<typeof createPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;

export type Like = z.infer<typeof likeSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type CreateComment = z.infer<typeof createCommentSchema>;