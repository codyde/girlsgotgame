import express from 'express';
import { db } from '../db/index';
import { 
  gamePlayers, 
  manualPlayers, 
  user as userTable, 
  gameStats, 
  gameActivities, 
  parentChildRelations 
} from '../db/schema';
import { eq, asc, and, like } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { checkGamePermission, logGameActivity, createErrorResponse } from './games-utils';

const router = express.Router();

// Get game with players and stats (filtered by user permissions)
router.get('/:gameId/players', requireAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const user = req.user!;

    // Get all game players with user and manual player info
    const players = await db
      .select({
        id: gamePlayers.id,
        gameId: gamePlayers.gameId,
        userId: gamePlayers.userId,
        manualPlayerId: gamePlayers.manualPlayerId,
        jerseyNumber: gamePlayers.jerseyNumber,
        isStarter: gamePlayers.isStarter,
        minutesPlayed: gamePlayers.minutesPlayed,
        createdAt: gamePlayers.createdAt,
        // User info
        userName: userTable.name,
        userEmail: userTable.email,
        userAvatar: userTable.avatarUrl,
        userJerseyNumber: userTable.jerseyNumber,
        // Manual player info
        manualPlayerName: manualPlayers.name,
        manualPlayerJersey: manualPlayers.jerseyNumber,
        manualPlayerNotes: manualPlayers.notes,
      })
      .from(gamePlayers)
      .leftJoin(userTable, eq(gamePlayers.userId, userTable.id))
      .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(asc(gamePlayers.createdAt));

    // Determine which players the user can see stats for
    let allowedUserIds: string[] = [];
    let isAdmin = false;
    
    if (req.user) {
      const user = req.user;
      isAdmin = user.isAdmin;
      
      if (isAdmin) {
        // Admins can see all player stats - no filtering needed
        // Don't populate allowedUserIds, we'll use isAdmin flag instead
      } else if (user.role === 'parent') {
        // Parents can only see their children's stats
        const childRelations = await db
          .select({ childId: parentChildRelations.childId })
          .from(parentChildRelations)
          .where(eq(parentChildRelations.parentId, user.id));
        
        allowedUserIds = childRelations.map(rel => rel.childId);
      } else if (user.role === 'player') {
        // Players can only see their own stats
        allowedUserIds = [user.id];
      }
    }

    // Get stats for each player, but only include stats for allowed users
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        let stats = [];
        let manualPlayerLinkedUserId = null;
        
        // If this is a manual player, get their linked user info
        if (player.manualPlayerId) {
          const manualPlayerInfo = await db
            .select({ linkedUserId: manualPlayers.linkedUserId })
            .from(manualPlayers)
            .where(eq(manualPlayers.id, player.manualPlayerId))
            .limit(1);
          
          if (manualPlayerInfo.length > 0) {
            manualPlayerLinkedUserId = manualPlayerInfo[0].linkedUserId;
          }
        }
        
        // Fetch stats based on permissions
        if (req.user) {
          const user = req.user;
          const isUserAdmin = user.isAdmin;
          
          // Admin sees all stats
          if (isUserAdmin) {
            stats = await db
              .select()
              .from(gameStats)
              .where(eq(gameStats.gamePlayerId, player.id))
              .orderBy(asc(gameStats.createdAt));
          }
          // Check if user has permission to see this player's stats
          else {
            let hasPermission = false;
            
            // Direct registered player - check if their userId is allowed
            if (player.userId && allowedUserIds.includes(player.userId)) {
              hasPermission = true;
            }
            // Manual player - check if they're linked to an allowed user
            else if (!player.userId && player.manualPlayerId && manualPlayerLinkedUserId) {
              hasPermission = allowedUserIds.includes(manualPlayerLinkedUserId);
            }
            // Unlinked manual players - everyone can see their stats
            else if (!player.userId && player.manualPlayerId && !manualPlayerLinkedUserId) {
              hasPermission = true;
            }
            
            if (hasPermission) {
              stats = await db
                .select()
                .from(gameStats)
                .where(eq(gameStats.gamePlayerId, player.id))
                .orderBy(asc(gameStats.createdAt));
            }
          }
        }

        return {
          id: player.id,
          gameId: player.gameId,
          userId: player.userId,
          manualPlayerId: player.manualPlayerId,
          jerseyNumber: player.jerseyNumber,
          isStarter: player.isStarter,
          minutesPlayed: player.minutesPlayed,
          createdAt: player.createdAt,
          user: player.userId ? {
            name: player.userName,
            email: player.userEmail,
            avatarUrl: player.userAvatar,
            jerseyNumber: player.userJerseyNumber,
          } : null,
          manualPlayer: player.manualPlayerId ? {
            name: player.manualPlayerName,
            jerseyNumber: player.manualPlayerJersey,
            notes: player.manualPlayerNotes,
            linkedUserId: manualPlayerLinkedUserId,
          } : null,
          stats: stats,
        };
      })
    );

    res.json(playersWithStats);
  } catch (error) {
    console.error('Error fetching game players:', error);
    res.status(500).json(createErrorResponse('Failed to fetch game players'));
  }
});

// Add registered player to game (admin only)
router.post('/:gameId/players', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.isAdmin;
    
    if (!isAdmin) {
      return res.status(403).json(createErrorResponse('Admin access required', 403));
    }

    const { gameId } = req.params;
    const { userId, jerseyNumber, isStarter } = req.body;

    if (!userId) {
      return res.status(400).json(createErrorResponse('User ID is required', 400));
    }

    // Check if player is already added to this game
    const [existingPlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.userId, userId)
      ));

    if (existingPlayer) {
      return res.status(400).json(createErrorResponse('Player is already added to this game', 400));
    }

    const [newGamePlayer] = await db
      .insert(gamePlayers)
      .values({
        gameId,
        userId,
        jerseyNumber: jerseyNumber || null,
        isStarter: isStarter || false,
      })
      .returning();

    // Log activity
    const [targetUser] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId));

    await logGameActivity(gameId, {
      activityType: 'player_added',
      description: `Added registered player ${targetUser[0]?.name || 'Unknown'} to the game`,
      metadata: { playerId: newGamePlayer.id, userId },
      performedBy: user.id,
    });

    res.status(201).json(newGamePlayer);
  } catch (error) {
    console.error('Error adding player to game:', error);
    res.status(500).json(createErrorResponse('Failed to add player to game'));
  }
});

// Add manual player to game (admin only)
router.post('/:gameId/manual-players', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.isAdmin;
    
    if (!isAdmin) {
      return res.status(403).json(createErrorResponse('Admin access required', 403));
    }

    const { gameId } = req.params;
    const { name, jerseyNumber, isStarter, notes } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json(createErrorResponse('Player name is required', 400));
    }

    // Check if manual player with this name already exists
    let manualPlayer = await db
      .select()
      .from(manualPlayers)
      .where(eq(manualPlayers.name, name.trim()))
      .limit(1);

    // Create manual player if doesn't exist
    if (manualPlayer.length === 0) {
      const [newManualPlayer] = await db
        .insert(manualPlayers)
        .values({
          name: name.trim(),
          jerseyNumber: jerseyNumber || null,
          notes: notes || null,
        })
        .returning();
      
      manualPlayer = [newManualPlayer];
    }

    // Check if this manual player is already added to this game
    const [existingGamePlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.manualPlayerId, manualPlayer[0].id)
      ));

    if (existingGamePlayer) {
      return res.status(400).json(createErrorResponse('This manual player is already added to this game', 400));
    }

    const [newGamePlayer] = await db
      .insert(gamePlayers)
      .values({
        gameId,
        manualPlayerId: manualPlayer[0].id,
        jerseyNumber: jerseyNumber || null,
        isStarter: isStarter || false,
      })
      .returning();

    // Log activity
    await logGameActivity(gameId, {
      activityType: 'player_added',
      description: `Added manual player ${name.trim()} to the game`,
      metadata: { playerId: newGamePlayer.id, manualPlayerId: manualPlayer[0].id },
      performedBy: user.id,
    });

    res.status(201).json({
      ...newGamePlayer,
      manualPlayer: manualPlayer[0],
    });
  } catch (error) {
    console.error('Error adding manual player to game:', error);
    res.status(500).json(createErrorResponse('Failed to add manual player to game'));
  }
});

// Get manual players for autocomplete
router.get('/manual-players/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    const manualPlayersList = await db
      .select()
      .from(manualPlayers)
      .where(like(manualPlayers.name, searchTerm))
      .orderBy(asc(manualPlayers.name))
      .limit(10);

    res.json(manualPlayersList);
  } catch (error) {
    console.error('Error searching manual players:', error);
    res.status(500).json(createErrorResponse('Failed to search manual players'));
  }
});

export default router;