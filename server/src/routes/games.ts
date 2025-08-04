import express from 'express';

// Import all game module routers
import gamesCoreRouter from './games-core';
import gamesSocialRouter from './games-social';
import gamesPlayersRouter from './games-players';
import gamesStatsRouter from './games-stats';
import gamesAdminRouter from './games-admin';

// Import remaining legacy routes that haven't been modularized yet
import { db } from '../db/index';
import { games, gamePlayers, manualPlayers, parentChildRelations, gameActivities, gameStats } from '../db/schema';
import { eq, asc, or, and } from 'drizzle-orm';
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

    // Permission check: admins, the user themselves, or their parents can view
    let hasPermission = user.isAdmin || user.id === userId;
    
    // If not admin or self, check if requesting user is a parent of this child
    if (!hasPermission && user.role === 'parent') {
      const parentChildRelationship = await db
        .select()
        .from(parentChildRelations)
        .where(
          and(
            eq(parentChildRelations.parentId, user.id),
            eq(parentChildRelations.childId, userId)
          )
        )
        .limit(1);
      
      hasPermission = parentChildRelationship.length > 0;
    }
    
    if (!hasPermission) {
      return res.status(403).json(createErrorResponse('You do not have permission to view this user\'s games', 403));
    }

    // Get games where the user participated (either directly or via linked manual players)
    const userGamesData = await db
      .select({
        gameId: games.id,
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
        // Game player info
        gamePlayerId: gamePlayers.id,
        jerseyNumber: gamePlayers.jerseyNumber,
        isStarter: gamePlayers.isStarter,
        minutesPlayed: gamePlayers.minutesPlayed,
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
      .orderBy(asc(games.gameDate));

    // Get stats for each game
    const gamesWithStats = await Promise.all(userGamesData.map(async (game) => {
      const stats = await db
        .select({
          id: gameStats.id,
          gameId: gameStats.gameId,
          gamePlayerId: gameStats.gamePlayerId,
          statType: gameStats.statType,
          value: gameStats.value,
          quarter: gameStats.quarter,
          timeMinute: gameStats.timeMinute,
          createdAt: gameStats.createdAt,
          createdBy: gameStats.createdBy,
        })
        .from(gameStats)
        .where(
          and(
            eq(gameStats.gameId, game.gameId),
            eq(gameStats.gamePlayerId, game.gamePlayerId)
          )
        )
        .orderBy(asc(gameStats.createdAt));

      return {
        id: game.gameId,
        teamName: game.teamName,
        isHome: game.isHome,
        opponentTeam: game.opponentTeam,
        gameDate: game.gameDate,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        notes: game.notes,
        status: game.status,
        isSharedToFeed: game.isSharedToFeed,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        gamePlayerId: game.gamePlayerId,
        jerseyNumber: game.jerseyNumber,
        isStarter: game.isStarter,
        stats: stats,
      };
    }));

    res.json(gamesWithStats);
  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json(createErrorResponse('Failed to fetch user games'));
  }
});

export default router;