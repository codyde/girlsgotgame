import express from 'express';

// Import all game module routers
import gamesCoreRouter from './games-core';
import gamesSocialRouter from './games-social';
import gamesPlayersRouter from './games-players';
import gamesStatsRouter from './games-stats';
import gamesAdminRouter from './games-admin';

// Import remaining legacy routes that haven't been modularized yet
import { db } from '../db/index';
import { games, gamePlayers, manualPlayers, parentChildRelations, gameActivities } from '../db/schema';
import { eq, asc, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { getChildUserIds, checkGamePermission, createErrorResponse } from './games-utils';

const router = express.Router();

// Mount modular routers
router.use('/', gamesCoreRouter);        // Basic CRUD operations
router.use('/', gamesSocialRouter);      // Comments and feed sharing  
router.use('/', gamesPlayersRouter);     // Player management
router.use('/', gamesStatsRouter);       // Statistics tracking
router.use('/', gamesAdminRouter);       // Admin functionality

// Legacy routes that haven't been moved to modules yet:

// Get game activities (could be moved to games-social.ts in future)
router.get('/:gameId/activities', requireAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const user = req.user!;

    // Check permissions to view game activities
    const hasPermission = await checkGamePermission(user.id, gameId, user.isAdmin);
    if (!hasPermission) {
      return res.status(403).json(createErrorResponse('You do not have permission to view this game', 403));
    }

    const activities = await db
      .select()
      .from(gameActivities)
      .where(eq(gameActivities.gameId, gameId))
      .orderBy(asc(gameActivities.createdAt));

    const activitiesWithParsedMetadata = activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }));

    res.json(activitiesWithParsedMetadata);
  } catch (error) {
    console.error('Error fetching game activities:', error);
    res.status(500).json(createErrorResponse('Failed to fetch game activities'));
  }
});

// Get games for specific user (could be moved to games-core.ts in future)
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user!;

    // Permission check: only admins or the user themselves can view
    if (!user.isAdmin && user.id !== userId) {
      return res.status(403).json(createErrorResponse('You do not have permission to view this user\'s games', 403));
    }

    // Get games where the user participated (either directly or via linked manual players)
    const userGames = await db
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
          eq(gamePlayers.userId, userId),
          eq(manualPlayers.linkedUserId, userId)
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

    res.json(userGames);
  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json(createErrorResponse('Failed to fetch user games'));
  }
});

export default router;