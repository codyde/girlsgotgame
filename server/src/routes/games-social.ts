import express from 'express';
import { db } from '../db/index';
import { games, gameComments, user as userTable, posts } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { createErrorResponse, validateRequiredFields } from './games-utils';

const router = express.Router();

// Get single game with comments
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    // Get game details
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      return res.status(404).json(createErrorResponse('Game not found', 404));
    }

    // Get game comments with user info
    const comments = await db
      .select({
        id: gameComments.id,
        gameId: gameComments.gameId,
        userId: gameComments.userId,
        content: gameComments.content,
        createdAt: gameComments.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
        userAvatar: userTable.avatarUrl,
      })
      .from(gameComments)
      .leftJoin(userTable, eq(gameComments.userId, userTable.id))
      .where(eq(gameComments.gameId, gameId))
      .orderBy(asc(gameComments.createdAt));

    res.json({
      game,
      comments: comments.map(comment => ({
        id: comment.id,
        gameId: comment.gameId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
        user: {
          name: comment.userName,
          email: comment.userEmail,
          avatarUrl: comment.userAvatar,
        }
      }))
    });
  } catch (error) {
    console.error('Error fetching game details:', error);
    res.status(500).json(createErrorResponse('Failed to fetch game details'));
  }
});

// Add comment to game
router.post('/:gameId/comments', requireAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { content } = req.body;
    const user = req.user!;

    const validation = validateRequiredFields(req.body, ['content']);
    if (validation) {
      return res.status(400).json(createErrorResponse(validation, 400));
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json(createErrorResponse('Comment content cannot be empty', 400));
    }

    // Verify game exists
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      return res.status(404).json(createErrorResponse('Game not found', 404));
    }

    const [newComment] = await db
      .insert(gameComments)
      .values({
        gameId,
        userId: user.id,
        content: content.trim(),
      })
      .returning();

    // Return comment with user info
    const commentWithUser = {
      id: newComment.id,
      gameId: newComment.gameId,
      userId: newComment.userId,
      content: newComment.content,
      createdAt: newComment.createdAt,
      user: {
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }
    };

    res.status(201).json(commentWithUser);
  } catch (error) {
    console.error('Error adding game comment:', error);
    res.status(500).json(createErrorResponse('Failed to add comment'));
  }
});

// Update game status and notes (admin only)
router.patch('/:gameId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { status, notes } = req.body;

    const updateData: any = { updatedAt: new Date() };
    
    if (status && ['upcoming', 'live', 'completed'].includes(status)) {
      updateData.status = status;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const [updatedGame] = await db
      .update(games)
      .set(updateData)
      .where(eq(games.id, gameId))
      .returning();

    if (!updatedGame) {
      return res.status(404).json(createErrorResponse('Game not found', 404));
    }

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game status:', error);
    res.status(500).json(createErrorResponse('Failed to update game status'));
  }
});

// Share game to feed (admin only)
router.post('/:gameId/share-to-feed', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.user!;
    const { gameId } = req.params;

    // Check if game is already shared to feed
    const [existingGame] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!existingGame) {
      return res.status(404).json(createErrorResponse('Game not found', 404));
    }

    if (existingGame.isSharedToFeed) {
      return res.status(400).json(createErrorResponse('Game is already shared to feed', 400));
    }

    // Update game to mark as shared
    const [updatedGame] = await db
      .update(games)
      .set({
        isSharedToFeed: true,
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    // Create a game card post in the feed
    const [newPost] = await db
      .insert(posts)
      .values({
        userId: user.id, // Admin who shared the game
        content: null, // No text content for game cards
        gameId: gameId,
        postType: 'game',
      })
      .returning();

    res.json({ 
      message: 'Game shared to feed successfully', 
      game: updatedGame,
      post: newPost 
    });
  } catch (error) {
    console.error('Error sharing game to feed:', error);
    res.status(500).json(createErrorResponse('Failed to share game to feed'));
  }
});

export default router;