import { Router } from 'express';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { posts, user, workouts, likes, comments, gameComments } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createPostSchema, updatePostSchema, createCommentSchema } from '../types';
import { emitToAll } from '../lib/socket';

const router = Router();

// Get feed posts with user and workout data
router.get('/feed', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const currentUserId = req.user!.id;

    const feedPosts = await db.query.posts.findMany({
      orderBy: [desc(posts.createdAt)],
      limit: Number(limit),
      offset: Number(offset),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
            jerseyNumber: true
          }
        },
        workout: true,
        media: true,
        game: true,
        likes: {
          columns: {
            userId: true
          }
        },
        comments: {
          orderBy: [desc(comments.createdAt)],
          limit: 3,
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    // For game posts, get game comment counts
    const gamePostIds = feedPosts
      .filter(post => post.gameId)
      .map(post => post.gameId)
      .filter(Boolean) as string[]; // Filter out any null/undefined values
    let gameCommentCounts: Record<string, number> = {};
    
    if (gamePostIds.length > 0) {
      const commentCountResults = await db
        .select({
          gameId: gameComments.gameId,
          count: sql<number>`cast(count(*) as int)`
        })
        .from(gameComments)
        .where(inArray(gameComments.gameId, gamePostIds))
        .groupBy(gameComments.gameId);
      
      gameCommentCounts = commentCountResults.reduce((acc, result) => {
        acc[result.gameId] = result.count;
        return acc;
      }, {} as Record<string, number>);
    }

    // Transform to include like counts and comment counts
    const transformedPosts = feedPosts.map(post => ({
      ...post,
      likesCount: post.likes.length,
      commentsCount: post.postType === 'game' && post.gameId 
        ? gameCommentCounts[post.gameId] || 0 
        : post.comments.length,
      userHasLiked: post.likes.some(like => like.userId === currentUserId)
    }));

    res.json(transformedPosts);
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's posts
router.get('/my-posts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const userPosts = await db.query.posts.findMany({
      where: eq(posts.userId, req.user!.id),
      orderBy: [desc(posts.createdAt)],
      limit: Number(limit),
      offset: Number(offset),
      with: {
        workout: true,
        media: true,
        likes: true,
        comments: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    res.json(userPosts);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create post
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createPostSchema.parse(req.body);

    const [newPost] = await db.insert(posts).values({
      userId: req.user!.id,
      ...validatedData
    }).returning();

    // Fetch the complete post with relations
    const completePost = await db.query.posts.findFirst({
      where: eq(posts.id, newPost.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
            jerseyNumber: true
          }
        },
        workout: true,
        media: true
      }
    });

    // Emit to all connected clients
    emitToAll('post_created', completePost);

    res.status(201).json(completePost);
  } catch (error) {
    console.error('Create post error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update post
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const validatedData = updatePostSchema.parse(req.body);

    const [updatedPost] = await db.update(posts)
      .set(validatedData)
      .where(and(
        eq(posts.id, id),
        eq(posts.userId, req.user!.id)
      ))
      .returning();

    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    // Emit to all connected clients
    emitToAll('post_updated', updatedPost);

    res.json(updatedPost);
  } catch (error) {
    console.error('Update post error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete post (owner or admin)
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const isAdmin = req.user?.email === 'codydearkland@gmail.com';
    
    // If admin, delete any post. If not admin, only delete own posts
    const deleteCondition = isAdmin 
      ? eq(posts.id, id)
      : and(
          eq(posts.id, id),
          eq(posts.userId, req.user!.id)
        );

    const deletedPost = await db.delete(posts)
      .where(deleteCondition)
      .returning();

    if (!deletedPost.length) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    // Emit to all connected clients
    emitToAll('post_deleted', id);

    res.status(204).send();
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/unlike post
router.post('/:id/like', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user!.id;

    // Check if already liked
    const existingLike = await db.query.likes.findFirst({
      where: and(
        eq(likes.postId, postId),
        eq(likes.userId, userId)
      )
    });

    if (existingLike) {
      // Unlike
      await db.delete(likes)
        .where(and(
          eq(likes.postId, postId),
          eq(likes.userId, userId)
        ));
      
      res.json({ liked: false });
    } else {
      // Like
      await db.insert(likes).values({
        postId,
        userId
      });
      
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like/unlike post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to post
router.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: postId } = req.params;
    const validatedData = createCommentSchema.parse(req.body);

    const [newComment] = await db.insert(comments).values({
      postId,
      userId: req.user!.id,
      ...validatedData
    }).returning();

    // Fetch the complete comment with user data
    const completeComment = await db.query.comments.findFirst({
      where: eq(comments.id, newComment.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json(completeComment);
  } catch (error) {
    console.error('Add comment error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get post comments
router.get('/:id/comments', async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const postComments = await db.query.comments.findMany({
      where: eq(comments.postId, postId),
      orderBy: [desc(comments.createdAt)],
      limit: Number(limit),
      offset: Number(offset),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      }
    });

    res.json(postComments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete comment
router.delete('/comments/:commentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { commentId } = req.params;

    const deletedComment = await db.delete(comments)
      .where(and(
        eq(comments.id, commentId),
        eq(comments.userId, req.user!.id)
      ))
      .returning();

    if (!deletedComment.length) {
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;