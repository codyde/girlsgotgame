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
import { eq, asc, and, like, or } from 'drizzle-orm';
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
      .select({ name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId));

    const playerDisplayName = targetUser?.name || targetUser?.email || 'Unknown User';

    await logGameActivity(gameId, {
      activityType: 'player_added',
      description: `Added registered player ${playerDisplayName} to the game`,
      metadata: { playerId: newGamePlayer.id, userId },
      performedBy: user.id,
    });

    res.status(201).json(newGamePlayer);
  } catch (error) {
    console.error('Error adding player to game:', error);
    res.status(500).json(createErrorResponse('Failed to add player to game'));
  }
});

// Add manual player to game (admin only) - Creates user in unified table
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

    // Create unique email for manual player
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const timestamp = Date.now();
    const manualEmail = `${cleanName}.${timestamp}@manual.local`;

    // Check if a user with this name already exists
    let existingUser = await db
      .select()
      .from(userTable)
      .where(eq(userTable.name, name.trim()))
      .limit(1);

    let playerId;
    
    if (existingUser.length === 0) {
      // Create new user in unified table
      const [newUser] = await db
        .insert(userTable)
        .values({
          id: `manual_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          name: name.trim(),
          email: manualEmail,
          emailVerified: false,
          role: 'player',
          isOnboarded: true,
          isVerified: false,
          jerseyNumber: jerseyNumber || null,
          createdBy: 'manual',
        })
        .returning();
      
      playerId = newUser.id;
    } else {
      playerId = existingUser[0].id;
    }

    // Check if this player is already added to this game
    const [existingGamePlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.userId, playerId)
      ));

    if (existingGamePlayer) {
      return res.status(400).json(createErrorResponse('This player is already added to this game', 400));
    }

    // Add player to game
    const [newGamePlayer] = await db
      .insert(gamePlayers)
      .values({
        gameId,
        userId: playerId,
        jerseyNumber: jerseyNumber || null,
        isStarter: isStarter || false,
      })
      .returning();

    // Log activity
    await logGameActivity(gameId, {
      activityType: 'player_added',
      description: `Added manual player ${name.trim()} to the game`,
      metadata: { playerId: newGamePlayer.id, userId: playerId },
      performedBy: user.id,
    });

    res.status(201).json({
      ...newGamePlayer,
      user: { id: playerId, name: name.trim(), email: manualEmail }
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

// Search all players in unified user table
router.get('/players/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    
    // Search all users (both OAuth and manual) in unified table
    const allPlayers = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        jerseyNumber: userTable.jerseyNumber,
        avatarUrl: userTable.avatarUrl,
        createdBy: userTable.createdBy,
        role: userTable.role,
      })
      .from(userTable)
      .where(
        and(
          eq(userTable.role, 'player'),
          or(
            like(userTable.name, searchTerm),
            like(userTable.email, searchTerm)
          )
        )
      )
      .orderBy(asc(userTable.name))
      .limit(20);

    res.json(allPlayers);
  } catch (error) {
    console.error('Error searching all players:', error);
    res.status(500).json(createErrorResponse('Failed to search players'));
  }
});

// Bulk add players to game (admin only)
router.post('/:gameId/players/bulk', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.isAdmin;
    
    if (!isAdmin) {
      return res.status(403).json(createErrorResponse('Admin access required', 403));
    }

    const { gameId } = req.params;
    const { players } = req.body; // Array of { id: string, name?: string }

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json(createErrorResponse('Players array is required and must not be empty', 400));
    }

    const results = [];
    const errors = [];

    for (const player of players) {
      try {
        // Check if player is already added to this game
        const [existingPlayer] = await db
          .select()
          .from(gamePlayers)
          .where(and(
            eq(gamePlayers.gameId, gameId),
            eq(gamePlayers.userId, player.id)
          ));

        if (existingPlayer) {
          errors.push(`${player.name || player.id} is already in this game`);
          continue;
        }

        // Add player to game
        const [newGamePlayer] = await db
          .insert(gamePlayers)
          .values({
            gameId,
            userId: player.id,
            isStarter: false,
          })
          .returning();

        // Get player name for activity log
        const [targetUser] = await db
          .select({ name: userTable.name, email: userTable.email, createdBy: userTable.createdBy })
          .from(userTable)
          .where(eq(userTable.id, player.id));

        const playerDisplayName = targetUser?.name || targetUser?.email || 'Unknown User';
        const playerType = targetUser?.createdBy === 'manual' ? 'manual' : 'registered';

        // Log activity
        await logGameActivity(gameId, {
          activityType: 'player_added',
          description: `Added ${playerType} player ${playerDisplayName} to the game`,
          metadata: { playerId: newGamePlayer.id, userId: player.id },
          performedBy: user.id,
        });

        results.push({ id: player.id, name: playerDisplayName, gamePlayerId: newGamePlayer.id, createdBy: playerType });
      } catch (error) {
        console.error(`Error adding player ${player.id}:`, error);
        errors.push(`Failed to add ${player.name || player.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    res.status(200).json({
      message: `Added ${results.length} players to the game`,
      added: results,
      errors: errors,
      totalProcessed: players.length,
      successCount: results.length,
      errorCount: errors.length
    });
  } catch (error) {
    console.error('Error bulk adding players to game:', error);
    res.status(500).json(createErrorResponse('Failed to bulk add players to game'));
  }
});

// Remove player from game (admin only)
router.delete('/:gameId/players/:playerId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.isAdmin;
    
    if (!isAdmin) {
      return res.status(403).json(createErrorResponse('Admin access required', 403));
    }

    const { gameId, playerId } = req.params;

    // Get player info before deletion for activity log
    const [gamePlayer] = await db
      .select({
        id: gamePlayers.id,
        userId: gamePlayers.userId,
        manualPlayerId: gamePlayers.manualPlayerId,
        userName: userTable.name,
        userEmail: userTable.email,
        manualPlayerName: manualPlayers.name,
      })
      .from(gamePlayers)
      .leftJoin(userTable, eq(gamePlayers.userId, userTable.id))
      .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
      .where(and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.id, playerId)
      ));

    if (!gamePlayer) {
      return res.status(404).json(createErrorResponse('Player not found in this game', 404));
    }

    // Delete the game player record
    await db
      .delete(gamePlayers)
      .where(eq(gamePlayers.id, playerId));

    // Determine player name for activity log
    const playerDisplayName = gamePlayer.userName || gamePlayer.userEmail || gamePlayer.manualPlayerName || 'Unknown Player';

    // Log activity
    await logGameActivity(gameId, {
      activityType: 'player_removed',
      description: `Removed player ${playerDisplayName} from the game`,
      metadata: { 
        playerId, 
        userId: gamePlayer.userId, 
        manualPlayerId: gamePlayer.manualPlayerId 
      },
      performedBy: user.id,
    });

    res.json({ message: 'Player removed from game successfully' });
  } catch (error) {
    console.error('Error removing player from game:', error);
    res.status(500).json(createErrorResponse('Failed to remove player from game'));
  }
});

export default router;