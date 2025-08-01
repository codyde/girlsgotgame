import express from 'express';
import { db } from '../db/index';
import { games, gamePlayers, manualPlayers, parentChildRelations } from '../db/schema';
import { eq, asc, or } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getSocketIO } from '../lib/socket';
import { getChildUserIds, createErrorResponse, validateRequiredFields } from './games-utils';

const router = express.Router();

// Get all games (everyone sees all games)
router.get('/', async (req, res) => {
  try {
    // Return all games for everyone
    const allGames = await db
      .select()
      .from(games)
      .orderBy(asc(games.gameDate));
    
    res.json(allGames);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json(createErrorResponse('Failed to fetch games'));
  }
});

// Get my games (games where user or their children participated)
router.get('/my-games', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    
    if (user.isAdmin) {
      // Admins see all games as "their games"
      const allGames = await db
        .select()
        .from(games)
        .orderBy(asc(games.gameDate));
      return res.json(allGames);
    }
    
    if (user.role === 'parent') {
      // Parents see games where their children participated
      const childUserIds = await getChildUserIds(user.id);
        
      if (childUserIds.length === 0) {
        // Parent has no assigned children, return empty array
        return res.json([]);
      }
      
      // Get games where any of the parent's children participated (either directly or via linked manual players)
      const parentGames = await db
        .select({
          id: games.id,
          teamName: games.teamName,
          isHome: games.isHome,
          opponentTeam: games.opponentTeam,
          gameDate: games.gameDate,
          homeScore: games.homeScore,
          awayScore: games.awayScore,
          notes: games.notes,
          status: games.status,
          isSharedToFeed: games.isSharedToFeed,
          createdAt: games.createdAt,
          updatedAt: games.updatedAt,
        })
        .from(games)
        .innerJoin(gamePlayers, eq(games.id, gamePlayers.gameId))
        .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
        .where(
          or(
            ...childUserIds.map(childId => eq(gamePlayers.userId, childId)),
            ...childUserIds.map(childId => eq(manualPlayers.linkedUserId, childId))
          )
        )
        .groupBy(
          games.id,
          games.teamName,
          games.isHome,
          games.opponentTeam,
          games.gameDate,
          games.homeScore,
          games.awayScore,
          games.notes,
          games.status,
          games.isSharedToFeed,
          games.createdAt,
          games.updatedAt
        )
        .orderBy(asc(games.gameDate));
        
      return res.json(parentGames);
    } else {
      // Players see games they participated in
      const playerGames = await db
        .select({
          id: games.id,
          teamName: games.teamName,
          isHome: games.isHome,
          opponentTeam: games.opponentTeam,
          gameDate: games.gameDate,
          homeScore: games.homeScore,
          awayScore: games.awayScore,
          notes: games.notes,
          status: games.status,
          isSharedToFeed: games.isSharedToFeed,
          createdAt: games.createdAt,
          updatedAt: games.updatedAt,
        })
        .from(games)
        .innerJoin(gamePlayers, eq(games.id, gamePlayers.gameId))
        .where(eq(gamePlayers.userId, user.id))
        .orderBy(asc(games.gameDate));
        
      return res.json(playerGames);
    }
  } catch (error) {
    console.error('Error fetching my games:', error);
    res.status(500).json(createErrorResponse('Failed to fetch my games'));
  }
});

// Create a new game (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validation = validateRequiredFields(req.body, ['teamName', 'isHome', 'opponentTeam', 'gameDate']);
    if (validation) {
      return res.status(400).json(createErrorResponse(validation, 400));
    }

    const { teamName, isHome, opponentTeam, gameDate } = req.body;

    if (typeof isHome !== 'boolean') {
      return res.status(400).json(createErrorResponse('isHome must be a boolean', 400));
    }

    const [newGame] = await db
      .insert(games)
      .values({
        teamName,
        isHome,
        opponentTeam,
        gameDate: new Date(gameDate),
      })
      .returning();

    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json(createErrorResponse('Failed to create game'));
  }
});

// Update game score (admin only)
router.patch('/:gameId/score', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { homeScore, awayScore } = req.body;

    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
      return res.status(400).json(createErrorResponse('Home and away scores must be numbers', 400));
    }

    const [updatedGame] = await db
      .update(games)
      .set({
        homeScore,
        awayScore,
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    if (!updatedGame) {
      return res.status(404).json(createErrorResponse('Game not found', 404));
    }

    // Emit live score update via websocket for manual score edits
    const io = getSocketIO();
    if (io) {
      io.emit('game:score-updated', {
        gameId,
        homeScore,
        awayScore,
        isManualUpdate: true
      });
    }

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game score:', error);
    res.status(500).json(createErrorResponse('Failed to update game score'));
  }
});

// Update game details (admin only)
router.patch('/:gameId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { gameDate, teamName, opponentTeam, isHome } = req.body;

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (gameDate) updateData.gameDate = new Date(gameDate);
    if (teamName) updateData.teamName = teamName;
    if (opponentTeam) updateData.opponentTeam = opponentTeam;
    if (typeof isHome === 'boolean') updateData.isHome = isHome;

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
    console.error('Error updating game:', error);
    res.status(500).json(createErrorResponse('Failed to update game'));
  }
});

// Delete a game (admin only)
router.delete('/:gameId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    const [deletedGame] = await db
      .delete(games)
      .where(eq(games.id, gameId))
      .returning();

    if (!deletedGame) {
      return res.status(404).json(createErrorResponse('Game not found', 404));
    }

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json(createErrorResponse('Failed to delete game'));
  }
});

export default router;