import express from 'express';
import { db } from '../db/index';
import { games, gameStats, gamePlayers, manualPlayers, user as userTable, gameActivities, parentChildRelations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { getSocketIO } from '../lib/socket';
import { logGameActivity, emitGameUpdate, canModifyStats, createErrorResponse, resolvePlayerName } from './games-utils';

const router = express.Router();

// Add stat to player (admin or parent of player)
router.post('/:gameId/players/:playerId/stats', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.isAdmin;

    const { gameId, playerId } = req.params;
    const { statType, value, quarter, timeMinute } = req.body;

    const validStatTypes = ['2pt', '3pt', '1pt', 'steal', 'rebound'];
    if (!validStatTypes.includes(statType)) {
      return res.status(400).json(createErrorResponse('Invalid stat type', 400));
    }

    // Verify game player exists
    const [gamePlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(
        eq(gamePlayers.id, playerId),
        eq(gamePlayers.gameId, gameId)
      ));

    if (!gamePlayer) {
      return res.status(404).json(createErrorResponse('Game player not found', 404));
    }

    // Check permissions: admin or parent of the player
    let hasPermission = isAdmin;
    
    if (!isAdmin && user.role === 'parent' && gamePlayer.userId) {
      // Check if this parent has permission to manage this player's stats
      const parentRelation = await db
        .select()
        .from(parentChildRelations)
        .where(and(
          eq(parentChildRelations.parentId, user.id),
          eq(parentChildRelations.childId, gamePlayer.userId)
        ))
        .limit(1);
      
      hasPermission = parentRelation.length > 0;
    }
    
    if (!hasPermission) {
      return res.status(403).json(createErrorResponse('Permission denied: You can only add stats for your own children', 403));
    }

    const [newStat] = await db
      .insert(gameStats)
      .values({
        gameId,
        gamePlayerId: playerId,
        statType,
        value: value || 1,
        quarter: quarter || null,
        timeMinute: timeMinute || null,
        createdBy: user.id,
      })
      .returning();

    // Get player name for activity log
    const playerName = await resolvePlayerName(gamePlayer.userId, gamePlayer.manualPlayerId);

    // Auto-update game score for scoring stats
    if (['2pt', '3pt', '1pt'].includes(statType)) {
      // Get current game data
      const [currentGame] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId));

      if (currentGame) {
        // Calculate points to add based on stat type
        let pointsToAdd = 0;
        if (statType === '3pt') pointsToAdd = 3;
        else if (statType === '2pt') pointsToAdd = 2;
        else if (statType === '1pt') pointsToAdd = 1;

        // Update the appropriate score (home or away based on team)
        // Since we're tracking our team's stats, we add to home score if isHome=true, away score if isHome=false
        const newHomeScore = currentGame.isHome 
          ? (currentGame.homeScore || 0) + pointsToAdd
          : currentGame.homeScore || 0;
        const newAwayScore = !currentGame.isHome 
          ? (currentGame.awayScore || 0) + pointsToAdd
          : currentGame.awayScore || 0;

        await db
          .update(games)
          .set({
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            updatedAt: new Date(),
          })
          .where(eq(games.id, gameId));

        // Log score update activity
        await logGameActivity(gameId, {
          activityType: 'score_updated',
          description: `Score updated: ${newHomeScore}-${newAwayScore} (${pointsToAdd} pts from ${playerName}'s ${statType})`,
          metadata: { 
            previousHomeScore: currentGame.homeScore,
            previousAwayScore: currentGame.awayScore,
            newHomeScore,
            newAwayScore,
            pointsAdded: pointsToAdd,
            statType,
            playerName 
          },
          performedBy: user.id,
        }, false); // Don't emit via logGameActivity, we'll use custom emission below

        // Emit live score update via websocket
        const io = getSocketIO();
        if (io) {
          io.emit('game:score-updated', {
            gameId,
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            previousHomeScore: currentGame.homeScore,
            previousAwayScore: currentGame.awayScore,
            pointsAdded: pointsToAdd,
            playerName,
            statType
          });
        }
      }
    }

    // Create engaging activity description
    let activityDescription = '';
    switch (statType) {
      case '3pt':
        activityDescription = `${playerName} sank a 3-pointer! 🎯`;
        break;
      case '2pt':
        activityDescription = `${playerName} scored 2 points! 🏀`;
        break;
      case '1pt':
        activityDescription = `${playerName} made a free throw! 🎯`;
        break;
      case 'steal':
        activityDescription = `${playerName} stole the ball! 🔥`;
        break;
      case 'rebound':
        activityDescription = `${playerName} grabbed a rebound! 💪`;
        break;
      default:
        activityDescription = `${playerName} recorded a ${statType}`;
    }

    // Log activity
    await logGameActivity(gameId, {
      activityType: 'stat_added',
      description: activityDescription,
      metadata: { statId: newStat.id, statType, value, playerName },
      performedBy: user.id,
    }, false); // Don't emit via logGameActivity, we'll use custom emission below

    // Emit live activity update via websocket
    const io = getSocketIO();
    if (io) {
      io.emit('game:activity-added', {
        gameId,
        activity: {
          id: 'temp-' + Date.now(), // temporary ID for optimistic updates
          gameId,
          activityType: 'stat_added',
          description: activityDescription,
          performedByUser: {
            name: user.name,
            email: user.email,
          },
          createdAt: new Date().toISOString(),
        },
        stat: {
          ...newStat,
          playerName
        }
      });
    }

    res.status(201).json(newStat);
  } catch (error) {
    console.error('Error adding stat:', error);
    res.status(500).json(createErrorResponse('Failed to add stat'));
  }
});

// Remove stat (admin or parent of player)
router.delete('/:gameId/stats/:statId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.isAdmin;

    const { gameId, statId } = req.params;

    // Get stat details before deletion for activity log
    const [stat] = await db
      .select({
        id: gameStats.id,
        statType: gameStats.statType,
        value: gameStats.value,
        gamePlayerId: gameStats.gamePlayerId,
      })
      .from(gameStats)
      .where(and(
        eq(gameStats.id, statId),
        eq(gameStats.gameId, gameId)
      ));

    if (!stat) {
      return res.status(404).json(createErrorResponse('Stat not found', 404));
    }

    // Get player details and check permissions
    const [gamePlayer] = await db
      .select({
        // Game player info
        gamePlayerId: gamePlayers.id,
        userId: gamePlayers.userId,
        manualPlayerId: gamePlayers.manualPlayerId,
        // User info (if linked)
        userName: userTable.name,
        // Manual player info (if present)
        manualPlayerName: manualPlayers.name,
      })
      .from(gamePlayers)
      .leftJoin(userTable, eq(gamePlayers.userId, userTable.id))
      .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
      .where(eq(gamePlayers.id, stat.gamePlayerId));

    if (!gamePlayer) {
      return res.status(404).json(createErrorResponse('Game player not found', 404));
    }

    // Check permissions: admin or parent of the player
    let hasPermission = isAdmin;
    
    if (!isAdmin && user.role === 'parent' && gamePlayer.userId) {
      // Check if this parent has permission to manage this player's stats
      const parentRelation = await db
        .select()
        .from(parentChildRelations)
        .where(and(
          eq(parentChildRelations.parentId, user.id),
          eq(parentChildRelations.childId, gamePlayer.userId)
        ))
        .limit(1);
      
      hasPermission = parentRelation.length > 0;
    }
    
    if (!hasPermission) {
      return res.status(403).json(createErrorResponse('Permission denied: You can only remove stats for your own children', 403));
    }

    let playerName = 'Unknown Player';
    if (gamePlayer.userId) {
      playerName = gamePlayer.userName || 'Unknown Player';
    } else if (gamePlayer.manualPlayerId) {
      playerName = gamePlayer.manualPlayerName || 'Unknown Player';
    }

    // Auto-update game score for scoring stats (subtract points)
    if (['2pt', '3pt', '1pt'].includes(stat.statType)) {
      // Get current game data
      const [currentGame] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId));

      if (currentGame) {
        // Calculate points to subtract based on stat type
        let pointsToSubtract = 0;
        if (stat.statType === '3pt') pointsToSubtract = 3;
        else if (stat.statType === '2pt') pointsToSubtract = 2;
        else if (stat.statType === '1pt') pointsToSubtract = 1;

        // Update the appropriate score (home or away based on team)
        const newHomeScore = currentGame.isHome 
          ? Math.max(0, (currentGame.homeScore || 0) - pointsToSubtract)
          : currentGame.homeScore || 0;
        const newAwayScore = !currentGame.isHome 
          ? Math.max(0, (currentGame.awayScore || 0) - pointsToSubtract)
          : currentGame.awayScore || 0;

        await db
          .update(games)
          .set({
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            updatedAt: new Date(),
          })
          .where(eq(games.id, gameId));

        // Log score update activity
        await logGameActivity(gameId, {
          activityType: 'score_updated',
          description: `Score updated: ${newHomeScore}-${newAwayScore} (removed ${pointsToSubtract} pts from ${playerName}'s ${stat.statType})`,
          metadata: { 
            previousHomeScore: currentGame.homeScore,
            previousAwayScore: currentGame.awayScore,
            newHomeScore,
            newAwayScore,
            pointsSubtracted: pointsToSubtract,
            statType: stat.statType,
            playerName 
          },
          performedBy: user.id,
        }, false); // Don't emit via logGameActivity, we'll use custom emission below

        // Emit live score update via websocket
        const io = getSocketIO();
        if (io) {
          io.emit('game:score-updated', {
            gameId,
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            previousHomeScore: currentGame.homeScore,
            previousAwayScore: currentGame.awayScore,
            pointsSubtracted: pointsToSubtract,
            playerName,
            statType: stat.statType
          });
        }
      }
    }

    // Delete the stat
    await db
      .delete(gameStats)
      .where(eq(gameStats.id, statId));

    // Create engaging removal description
    let removalDescription = '';
    switch (stat.statType) {
      case '3pt':
        removalDescription = `${playerName}'s 3-pointer was corrected`;
        break;
      case '2pt':
        removalDescription = `${playerName}'s 2-point shot was corrected`;
        break;
      case '1pt':
        removalDescription = `${playerName}'s free throw was corrected`;
        break;
      case 'steal':
        removalDescription = `${playerName}'s steal was corrected`;
        break;
      case 'rebound':
        removalDescription = `${playerName}'s rebound was corrected`;
        break;
      default:
        removalDescription = `${playerName}'s ${stat.statType} was corrected`;
    }

    // Log activity
    await logGameActivity(gameId, {
      activityType: 'stat_removed',
      description: removalDescription,
      metadata: { statType: stat.statType, value: stat.value, playerName },
      performedBy: user.id,
    }, false); // Don't emit via logGameActivity, we'll use custom emission below

    // Emit live activity update via websocket
    const io = getSocketIO();
    if (io) {
      io.emit('game:activity-added', {
        gameId,
        activity: {
          id: 'temp-' + Date.now(), // temporary ID for optimistic updates
          gameId,
          activityType: 'stat_removed',
          description: removalDescription,
          performedByUser: {
            name: user.name,
            email: user.email,
          },
          createdAt: new Date().toISOString(),
        },
        statRemoved: {
          id: statId,
          statType: stat.statType,
          value: stat.value,
          playerName
        }
      });
    }

    res.json({ message: 'Stat removed successfully' });
  } catch (error) {
    console.error('Error removing stat:', error);
    res.status(500).json(createErrorResponse('Failed to remove stat'));
  }
});

export default router;