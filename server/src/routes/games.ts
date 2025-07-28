import express from 'express';
import { db } from '../db/index';
import { games, gameComments, user as userTable, posts, gamePlayers, manualPlayers, gameStats, gameActivities, parentChildRelations } from '../db/schema';
import { eq, asc, desc, like, or, and, isNull, isNotNull, inArray } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getSocketIO } from '../lib/socket';

const router = express.Router();

// Get all games (filtered by user role and parent-child relationships)
router.get('/', async (req, res) => {
  try {
    // If no auth, return all games (for backward compatibility)
    if (!req.user) {
      const allGames = await db
        .select()
        .from(games)
        .orderBy(asc(games.gameDate));
      return res.json(allGames);
    }

    const user = req.user;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    let gamesQuery;
    
    if (isAdmin) {
      // Admins see all games
      gamesQuery = db
        .select()
        .from(games)
        .orderBy(asc(games.gameDate));
    } else if (user.role === 'parent') {
      // Parents only see games where their children participated
      const childRelations = await db
        .select({ childId: parentChildRelations.childId })
        .from(parentChildRelations)
        .where(eq(parentChildRelations.parentId, user.id));
      
      if (childRelations.length === 0) {
        // Parent has no assigned children, return all games for now
        // This prevents parents from seeing empty lists if relationships aren't set up
        const allGames = await db
          .select()
          .from(games)
          .orderBy(asc(games.gameDate));
        return res.json(allGames);
      }
      
      const childUserIds = childRelations.map(rel => rel.childId);
      
      // Get games where any of the parent's children participated
      gamesQuery = db
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
        .where(
          or(...childUserIds.map(childId => eq(gamePlayers.unifiedUserId, childId)))
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
    } else {
      // Regular players see games they participated in, or all games if not in any
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
        .where(eq(gamePlayers.unifiedUserId, user.id))
        .orderBy(asc(games.gameDate));
      
      if (playerGames.length === 0) {
        // If player isn't in any games, show all games
        const allGames = await db
          .select()
          .from(games)
          .orderBy(asc(games.gameDate));
        return res.json(allGames);
      }
      
      return res.json(playerGames);
    }
    
    const gameResults = await gamesQuery;
    res.json(gameResults);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Create a new game (admin only)
router.post('/', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { teamName, isHome, opponentTeam, gameDate } = req.body;

    if (!teamName || typeof isHome !== 'boolean' || !opponentTeam || !gameDate) {
      return res.status(400).json({ error: 'Missing required fields' });
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
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Update game score (admin only)
router.patch('/:gameId/score', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameId } = req.params;
    const { homeScore, awayScore } = req.body;

    // Check if game stats are locked (admins can still update scores even when locked)
    const [game] = await db
      .select({ statsLocked: games.statsLocked })
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
      return res.status(400).json({ error: 'Home and away scores must be numbers' });
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
      return res.status(404).json({ error: 'Game not found' });
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
    res.status(500).json({ error: 'Failed to update game score' });
  }
});

// Lock/unlock game stats (admin only)
router.patch('/:gameId/stats-lock', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameId } = req.params;
    const { statsLocked } = req.body;

    if (typeof statsLocked !== 'boolean') {
      return res.status(400).json({ error: 'statsLocked must be a boolean' });
    }

    const [updatedGame] = await db
      .update(games)
      .set({ 
        statsLocked,
        updatedAt: new Date()
      })
      .where(eq(games.id, gameId))
      .returning();

    if (!updatedGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Emit stats lock update via websocket
    const io = getSocketIO();
    if (io) {
      io.emit('game:stats-lock-updated', {
        gameId,
        statsLocked,
        updatedBy: user.id
      });
    }

    res.json({ 
      success: true, 
      message: `Game stats ${statsLocked ? 'locked' : 'unlocked'} successfully`,
      game: updatedGame 
    });
  } catch (error) {
    console.error('Error updating game stats lock:', error);
    res.status(500).json({ error: 'Failed to update game stats lock' });
  }
});

// Update game details (admin only)
router.patch('/:gameId', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Delete a game (admin only)
router.delete('/:gameId', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameId } = req.params;

    const [deletedGame] = await db
      .delete(games)
      .where(eq(games.id, gameId))
      .returning();

    if (!deletedGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

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
      return res.status(404).json({ error: 'Game not found' });
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
    res.status(500).json({ error: 'Failed to fetch game details' });
  }
});

// Add comment to game
router.post('/:gameId/comments', requireAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { content } = req.body;
    const user = req.user!;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify game exists
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
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
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Update game status and notes (admin only)
router.patch('/:gameId/status', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game status:', error);
    res.status(500).json({ error: 'Failed to update game status' });
  }
});

// Share game to feed (admin only)
router.post('/:gameId/share-to-feed', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameId } = req.params;

    // Check if game is already shared to feed
    const [existingGame] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (existingGame.isSharedToFeed) {
      return res.status(400).json({ error: 'Game is already shared to feed' });
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
    res.status(500).json({ error: 'Failed to share game to feed' });
  }
});

// Get game with players and stats
router.get('/:gameId/players', async (req, res) => {
  try {
    const { gameId } = req.params;

    // Get game players with user and manual player info
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

    // Get stats for each player
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await db
          .select()
          .from(gameStats)
          .where(eq(gameStats.gamePlayerId, player.id))
          .orderBy(asc(gameStats.createdAt));

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
          } : null,
          stats: stats,
        };
      })
    );

    res.json(playersWithStats);
  } catch (error) {
    console.error('Error fetching game players:', error);
    res.status(500).json({ error: 'Failed to fetch game players' });
  }
});

// Add player to game (admin only) - works for both registered and manual players
router.post('/:gameId/players', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameId } = req.params;
    const { userId, jerseyNumber, isStarter } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // 🎯 UNIFIED SYSTEM: Check if player is already added to this game using unified_user_id
    const [existingPlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.unifiedUserId, userId)
      ));

    if (existingPlayer) {
      return res.status(400).json({ error: 'Player is already added to this game' });
    }

    // 🎯 UNIFIED SYSTEM: Insert using unified_user_id
    const [newGamePlayer] = await db
      .insert(gamePlayers)
      .values({
        gameId,
        unifiedUserId: userId,
        jerseyNumber: jerseyNumber || null,
        isStarter: isStarter || false,
      })
      .returning();

    // Log activity - get player name from unified user table
    const [targetUser] = await db
      .select({ 
        name: userTable.name,
        accountType: userTable.accountType 
      })
      .from(userTable)
      .where(eq(userTable.id, userId));

    const playerType = targetUser[0]?.accountType === 'manual' ? 'manual' : 'registered';
    
    await db.insert(gameActivities).values({
      gameId,
      activityType: 'player_added',
      description: `Added ${playerType} player ${targetUser[0]?.name || 'Unknown'} to the game`,
      metadata: JSON.stringify({ playerId: newGamePlayer.id, unifiedUserId: userId }),
      performedBy: user.id,
    });

    res.status(201).json(newGamePlayer);
  } catch (error) {
    console.error('Error adding player to game:', error);
    res.status(500).json({ error: 'Failed to add player to game' });
  }
});

// Create new manual player and add to game (admin only)
router.post('/:gameId/manual-players', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameId } = req.params;
    const { name, jerseyNumber, isStarter, notes } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    // 🎯 UNIFIED SYSTEM: Check if manual player with this name already exists in unified user table
    let existingUser = await db
      .select()
      .from(userTable)
      .where(and(
        eq(userTable.name, name.trim()),
        eq(userTable.accountType, 'manual')
      ))
      .limit(1);

    let unifiedUserId;
    
    // Create manual player in unified user table if doesn't exist
    if (existingUser.length === 0) {
      const [newUser] = await db
        .insert(userTable)
        .values({
          name: name.trim(),
          email: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@placeholder.com`,
          accountType: 'manual',
          hasLoginAccess: false,
          jerseyNumber: jerseyNumber || null,
          notes: notes || null,
          isVerified: false,
          onboardingCompleted: true,
        })
        .returning();
      
      unifiedUserId = newUser.id;
    } else {
      unifiedUserId = existingUser[0].id;
    }

    // 🎯 UNIFIED SYSTEM: Check if this player is already added to this game using unified_user_id
    const [existingGamePlayer] = await db
      .select()
      .from(gamePlayers)
      .where(and(
        eq(gamePlayers.gameId, gameId),
        eq(gamePlayers.unifiedUserId, unifiedUserId)
      ));

    if (existingGamePlayer) {
      return res.status(400).json({ error: 'This player is already added to this game' });
    }

    // 🎯 UNIFIED SYSTEM: Insert using unified_user_id
    const [newGamePlayer] = await db
      .insert(gamePlayers)
      .values({
        gameId,
        unifiedUserId: unifiedUserId,
        jerseyNumber: jerseyNumber || null,
        isStarter: isStarter || false,
      })
      .returning();

    // Log activity
    await db.insert(gameActivities).values({
      gameId,
      activityType: 'player_added',
      description: `Added manual player ${name.trim()} to the game`,
      metadata: JSON.stringify({ playerId: newGamePlayer.id, unifiedUserId: unifiedUserId }),
      performedBy: user.id,
    });

    res.status(201).json({
      ...newGamePlayer,
      user: {
        id: unifiedUserId,
        name: name.trim(),
        accountType: 'manual',
        hasLoginAccess: false,
        jerseyNumber: jerseyNumber || null,
        notes: notes || null,
      },
    });
  } catch (error) {
    console.error('Error adding manual player to game:', error);
    res.status(500).json({ error: 'Failed to add manual player to game' });
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
    res.status(500).json({ error: 'Failed to search manual players' });
  }
});

// Add stat to player (admin or parent of player)
router.post('/:gameId/players/:playerId/stats', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';

    const { gameId, playerId } = req.params;
    const { statType, value, quarter, timeMinute } = req.body;

    const validStatTypes = ['2pt', '3pt', '1pt', 'steal', 'rebound'];
    if (!validStatTypes.includes(statType)) {
      return res.status(400).json({ error: 'Invalid stat type' });
    }

    // Check if game stats are locked (only admins can bypass this)
    const [game] = await db
      .select({ statsLocked: games.statsLocked })
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.statsLocked && !isAdmin) {
      return res.status(403).json({ error: 'Game stats are locked. Contact an admin to make changes.' });
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
      return res.status(404).json({ error: 'Game player not found' });
    }

    // Check permissions: admin or parent of the player
    let hasPermission = isAdmin;
    
    if (!isAdmin && user.role === 'parent' && gamePlayer.unifiedUserId) {
      // 🎯 UNIFIED SYSTEM: Check if this parent has permission to manage this player's stats
      const parentRelation = await db
        .select()
        .from(parentChildRelations)
        .where(and(
          eq(parentChildRelations.parentId, user.id),
          eq(parentChildRelations.unifiedChildId, gamePlayer.unifiedUserId)
        ))
        .limit(1);
      
      hasPermission = parentRelation.length > 0;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied: You can only add stats for your own children' });
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

    // 🎯 UNIFIED SYSTEM: Get player name for activity log
    let playerName = 'Unknown Player';
    if (gamePlayer.unifiedUserId) {
      const [playerUser] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, gamePlayer.unifiedUserId));
      playerName = playerUser?.name || 'Unknown Player';
    }

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
        await db.insert(gameActivities).values({
          gameId,
          activityType: 'score_updated',
          description: `Score updated: ${newHomeScore}-${newAwayScore} (${pointsToAdd} pts from ${playerName}'s ${statType})`,
          metadata: JSON.stringify({ 
            previousHomeScore: currentGame.homeScore,
            previousAwayScore: currentGame.awayScore,
            newHomeScore,
            newAwayScore,
            pointsAdded: pointsToAdd,
            statType,
            playerName 
          }),
          performedBy: user.id,
        });

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
    await db.insert(gameActivities).values({
      gameId,
      activityType: 'stat_added',
      description: activityDescription,
      metadata: JSON.stringify({ statId: newStat.id, statType, value, playerName }),
      performedBy: user.id,
    });

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
    res.status(500).json({ error: 'Failed to add stat' });
  }
});

// Remove stat (admin or parent of player)
router.delete('/:gameId/stats/:statId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';

    const { gameId, statId } = req.params;

    // Check if game stats are locked (only admins can bypass this)
    const [game] = await db
      .select({ statsLocked: games.statsLocked })
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.statsLocked && !isAdmin) {
      return res.status(403).json({ error: 'Game stats are locked. Contact an admin to make changes.' });
    }

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
      return res.status(404).json({ error: 'Stat not found' });
    }

    // 🎯 UNIFIED SYSTEM: Get player details and check permissions
    const [gamePlayer] = await db
      .select()
      .from(gamePlayers)
      .innerJoin(userTable, eq(gamePlayers.unifiedUserId, userTable.id))
      .where(eq(gamePlayers.id, stat.gamePlayerId));

    if (!gamePlayer) {
      return res.status(404).json({ error: 'Game player not found' });
    }

    // Check permissions: admin or parent of the player
    let hasPermission = isAdmin;
    
    if (!isAdmin && user.role === 'parent' && gamePlayer.game_players.unifiedUserId) {
      // 🎯 UNIFIED SYSTEM: Check if this parent has permission to manage this player's stats
      const parentRelation = await db
        .select()
        .from(parentChildRelations)
        .where(and(
          eq(parentChildRelations.parentId, user.id),
          eq(parentChildRelations.unifiedChildId, gamePlayer.game_players.unifiedUserId)
        ))
        .limit(1);
      
      hasPermission = parentRelation.length > 0;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied: You can only remove stats for your own children' });
    }

    // 🎯 UNIFIED SYSTEM: Get player name from unified user table
    let playerName = gamePlayer.user_table?.name || 'Unknown Player';

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
        await db.insert(gameActivities).values({
          gameId,
          activityType: 'score_updated',
          description: `Score updated: ${newHomeScore}-${newAwayScore} (removed ${pointsToSubtract} pts from ${playerName}'s ${stat.statType})`,
          metadata: JSON.stringify({ 
            previousHomeScore: currentGame.homeScore,
            previousAwayScore: currentGame.awayScore,
            newHomeScore,
            newAwayScore,
            pointsSubtracted: pointsToSubtract,
            statType: stat.statType,
            playerName 
          }),
          performedBy: user.id,
        });

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
    await db.insert(gameActivities).values({
      gameId,
      activityType: 'stat_removed',
      description: removalDescription,
      metadata: JSON.stringify({ statType: stat.statType, value: stat.value, playerName }),
      performedBy: user.id,
    });

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
    res.status(500).json({ error: 'Failed to remove stat' });
  }
});

// Get game activities
router.get('/:gameId/activities', async (req, res) => {
  try {
    const { gameId } = req.params;

    const activities = await db
      .select({
        id: gameActivities.id,
        gameId: gameActivities.gameId,
        activityType: gameActivities.activityType,
        description: gameActivities.description,
        metadata: gameActivities.metadata,
        performedBy: gameActivities.performedBy,
        createdAt: gameActivities.createdAt,
        performedByName: userTable.name,
        performedByEmail: userTable.email,
      })
      .from(gameActivities)
      .leftJoin(userTable, eq(gameActivities.performedBy, userTable.id))
      .where(eq(gameActivities.gameId, gameId))
      .orderBy(desc(gameActivities.createdAt));

    res.json(activities.map(activity => ({
      ...activity,
      performedByUser: activity.performedBy ? {
        name: activity.performedByName,
        email: activity.performedByEmail,
      } : null,
    })));
  } catch (error) {
    console.error('Error fetching game activities:', error);
    res.status(500).json({ error: 'Failed to fetch game activities' });
  }
});

// Get games for a specific user with their stats (for parent dashboard)
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.email === 'codydearkland@gmail.com';
    const { userId } = req.params;

    // Check permissions: admin or parent of the user
    let hasPermission = isAdmin;
    
    if (!isAdmin && user.role === 'parent') {
      // Check if this parent has permission to view this user's games
      const parentRelation = await db
        .select()
        .from(parentChildRelations)
        .where(and(
          eq(parentChildRelations.parentId, user.id),
          eq(parentChildRelations.childId, userId)
        ))
        .limit(1);
      
      hasPermission = parentRelation.length > 0;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied: You can only view games for your own children' });
    }

    // 🎯 UNIFIED SYSTEM: Get all games where the user participated using unified_user_id
    const gamePlayerRecords = await db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.unifiedUserId, userId));

    if (gamePlayerRecords.length === 0) {
      return res.json([]);
    }

    // Get the actual games - use individual queries to avoid Drizzle recursion issues
    const gameIds = gamePlayerRecords.map(gp => gp.gameId);
    const gamePromises = gameIds.map(gameId => 
      db.select().from(games).where(eq(games.id, gameId)).limit(1)
    );
    
    const gameResults = await Promise.all(gamePromises);
    const userGames = gameResults.flat().sort((a, b) => 
      new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
    );

    // For each game, get the user's stats with error handling
    let gamesWithStats;
    try {
      gamesWithStats = await Promise.all(
        userGames.map(async (game) => {
          try {
            // Find the game player record for this user and game
            const gamePlayerRecord = gamePlayerRecords.find(gp => gp.gameId === game.id);
            
            if (!gamePlayerRecord) {
              return {
                ...game,
                stats: [],
                participationType: 'unknown',
                gamePlayerId: null,
                jerseyNumber: null,
                isStarter: false,
                minutesPlayed: 0,
              };
            }

            // Get all stats for this user in this game - use simple select to avoid recursion
            const stats = await db
              .select()
              .from(gameStats)
              .where(eq(gameStats.gamePlayerId, gamePlayerRecord.id))
              .orderBy(desc(gameStats.createdAt));

            return {
              ...game,
              stats: stats.map(stat => ({
                id: stat.id,
                statType: stat.statType,
                value: stat.value,
                quarter: stat.quarter,
                timeMinute: stat.timeMinute,
                createdAt: stat.createdAt,
                source: gamePlayerRecord.manualPlayerId ? 'manual' as const : 'direct' as const,
              })),
              // 🎯 UNIFIED SYSTEM: Determine participation type from legacy fields during transition
              participationType: gamePlayerRecord.manualPlayerId ? 'manual' : 'direct',
              gamePlayerId: gamePlayerRecord.id,
              jerseyNumber: gamePlayerRecord.jerseyNumber,
              isStarter: gamePlayerRecord.isStarter,
              minutesPlayed: gamePlayerRecord.minutesPlayed,
              unifiedUserId: gamePlayerRecord.unifiedUserId, // Include unified ID for frontend
            };
          } catch (gameError) {
            console.error(`Error processing game ${game.id}:`, gameError);
            return {
              ...game,
              stats: [],
              participationType: 'error',
              gamePlayerId: null,
              jerseyNumber: null,
              isStarter: false,
              minutesPlayed: 0,
            };
          }
        })
      );
    } catch (error) {
      console.error('Error in gamesWithStats processing:', error);
      throw error;
    }

    res.json(gamesWithStats);
  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json({ error: 'Failed to fetch user games' });
  }
});

// Get all manual players (admin only)
router.get('/admin/manual-players', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all manual players first
    const manualPlayersList = await db
      .select({
        id: manualPlayers.id,
        name: manualPlayers.name,
        jerseyNumber: manualPlayers.jerseyNumber,
        linkedUserId: manualPlayers.linkedUserId,
        linkedParentId: manualPlayers.linkedParentId,
        linkedBy: manualPlayers.linkedBy,
        linkedAt: manualPlayers.linkedAt,
        notes: manualPlayers.notes,
        createdAt: manualPlayers.createdAt,
        updatedAt: manualPlayers.updatedAt,
      })
      .from(manualPlayers)
      .orderBy(asc(manualPlayers.name));

    // Get linked users for manual players that have linkedUserId
    const linkedUserIds = manualPlayersList
      .filter(mp => mp.linkedUserId)
      .map(mp => mp.linkedUserId!)
      .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    const linkedUsers = linkedUserIds.length > 0 ? await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      })
      .from(userTable)
      .where(or(...linkedUserIds.map(id => eq(userTable.id, id))))
      : [];

    // Get linked parents for manual players that have linkedParentId
    const linkedParentIds = manualPlayersList
      .filter(mp => mp.linkedParentId)
      .map(mp => mp.linkedParentId!)
      .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    const linkedParents = linkedParentIds.length > 0 ? await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
      })
      .from(userTable)
      .where(or(...linkedParentIds.map(id => eq(userTable.id, id))))
      : [];

    // Combine the data
    const enrichedManualPlayersList = manualPlayersList.map(mp => ({
      ...mp,
      linkedUser: mp.linkedUserId ? linkedUsers.find(user => user.id === mp.linkedUserId) || null : null,
      linkedParent: mp.linkedParentId ? linkedParents.find(parent => parent.id === mp.linkedParentId) || null : null,
    }));

    res.json(enrichedManualPlayersList);
  } catch (error) {
    console.error('Error fetching manual players:', error);
    res.status(500).json({ error: 'Failed to fetch manual players' });
  }
});

// Link manual player to registered user (admin only)
router.patch('/admin/manual-players/:manualPlayerId/link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    const { userId } = req.body;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update the manual player with the linked user
    const [updatedManualPlayer] = await db
      .update(manualPlayers)
      .set({
        linkedUserId: userId,
        linkedBy: user.id,
        linkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualPlayers.id, manualPlayerId))
      .returning();

    if (!updatedManualPlayer) {
      return res.status(404).json({ error: 'Manual player not found' });
    }

    res.json({ message: 'Manual player linked successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error linking manual player:', error);
    res.status(500).json({ error: 'Failed to link manual player' });
  }
});

// Unlink manual player from registered user (admin only)
router.patch('/admin/manual-players/:manualPlayerId/unlink', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update the manual player to remove the link
    const [updatedManualPlayer] = await db
      .update(manualPlayers)
      .set({
        linkedUserId: null,
        linkedBy: null,
        linkedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(manualPlayers.id, manualPlayerId))
      .returning();

    if (!updatedManualPlayer) {
      return res.status(404).json({ error: 'Manual player not found' });
    }

    res.json({ message: 'Manual player unlinked successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error unlinking manual player:', error);
    res.status(500).json({ error: 'Failed to unlink manual player' });
  }
});

// Link manual player to parent (admin only)
router.patch('/admin/manual-players/:manualPlayerId/link-to-parent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    const { parentId } = req.body;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    // Verify parent exists and has parent role
    const [parent] = await db.select()
      .from(userTable)
      .where(eq(userTable.id, parentId))
      .limit(1);

    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ error: 'Parent not found or invalid role' });
    }

    // Update the manual player to link to parent
    const [updatedManualPlayer] = await db
      .update(manualPlayers)
      .set({
        linkedParentId: parentId,
        linkedBy: user.id,
        linkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualPlayers.id, manualPlayerId))
      .returning();

    if (!updatedManualPlayer) {
      return res.status(404).json({ error: 'Manual player not found' });
    }

    res.json({ message: 'Manual player linked to parent successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error linking manual player to parent:', error);
    res.status(500).json({ error: 'Failed to link manual player to parent' });
  }
});

// Unlink manual player from parent (admin only)
router.patch('/admin/manual-players/:manualPlayerId/unlink-from-parent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update the manual player to remove the parent link
    const [updatedManualPlayer] = await db
      .update(manualPlayers)
      .set({
        linkedParentId: null,
        linkedBy: null,
        linkedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(manualPlayers.id, manualPlayerId))
      .returning();

    if (!updatedManualPlayer) {
      return res.status(404).json({ error: 'Manual player not found' });
    }

    res.json({ message: 'Manual player unlinked from parent successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error unlinking manual player from parent:', error);
    res.status(500).json({ error: 'Failed to unlink manual player from parent' });
  }
});

// 🚨 DEPRECATED: Get manual players linked to a parent with their game stats
// This endpoint is no longer needed with the unified player system
// Use `/api/profiles/my-children` instead which returns ALL children (registered + manual)
router.get('/parent/:parentId/manual-players', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { parentId } = req.params;
    
    // Check if user is accessing their own data or is admin
    if (user.id !== parentId && user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get manual players linked to this parent
    const linkedManualPlayers = await db
      .select({
        id: manualPlayers.id,
        name: manualPlayers.name,
        jerseyNumber: manualPlayers.jerseyNumber,
        notes: manualPlayers.notes,
        linkedAt: manualPlayers.linkedAt,
        createdAt: manualPlayers.createdAt,
      })
      .from(manualPlayers)
      .where(eq(manualPlayers.linkedParentId, parentId))
      .orderBy(asc(manualPlayers.name));

    // For each manual player, get their game data
    const manualPlayersWithGames = await Promise.all(
      linkedManualPlayers.map(async (manualPlayer) => {
        // Get games where this manual player participated
        const playerGames = await db
          .select({
            id: games.id,
            teamName: games.teamName,
            isHome: games.isHome,
            opponentTeam: games.opponentTeam,
            gameDate: games.gameDate,
            homeScore: games.homeScore,
            awayScore: games.awayScore,
            status: games.status,
            jerseyNumber: gamePlayers.jerseyNumber,
            isStarter: gamePlayers.isStarter,
            minutesPlayed: gamePlayers.minutesPlayed,
          })
          .from(games)
          .innerJoin(gamePlayers, eq(games.id, gamePlayers.gameId))
          .where(eq(gamePlayers.manualPlayerId, manualPlayer.id))
          .orderBy(desc(games.gameDate));

        // Get stats for each game
        const gamesWithStats = await Promise.all(
          playerGames.map(async (game) => {
            const gamePlayer = await db
              .select({ id: gamePlayers.id })
              .from(gamePlayers)
              .where(
                and(
                  eq(gamePlayers.gameId, game.id),
                  eq(gamePlayers.manualPlayerId, manualPlayer.id)
                )
              )
              .limit(1);

            if (gamePlayer.length === 0) return { ...game, stats: [] };

            const stats = await db
              .select({
                id: gameStats.id,
                statType: gameStats.statType,
                value: gameStats.value,
                quarter: gameStats.quarter,
                timeMinute: gameStats.timeMinute,
                createdAt: gameStats.createdAt,
              })
              .from(gameStats)
              .where(eq(gameStats.gamePlayerId, gamePlayer[0].id))
              .orderBy(desc(gameStats.createdAt));

            return {
              ...game,
              stats: stats.map(stat => ({
                ...stat,
                source: 'manual' // Mark these as manual/historical stats
              })),
              participationType: 'manual',
              manualPlayerName: manualPlayer.name,
              manualPlayerJerseyNumber: manualPlayer.jerseyNumber,
            };
          })
        );

        return {
          ...manualPlayer,
          games: gamesWithStats,
        };
      })
    );

    res.json(manualPlayersWithGames);
  } catch (error) {
    console.error('Error fetching parent manual players:', error);
    res.status(500).json({ error: 'Failed to fetch parent manual players' });
  }
});

// Link manual player to parent (admin only)
router.patch('/admin/manual-players/:manualPlayerId/link-to-parent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    const { parentId } = req.body;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    // Verify parent exists and has parent role
    const [parent] = await db.select()
      .from(userTable)
      .where(eq(userTable.id, parentId))
      .limit(1);

    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ error: 'Parent not found or invalid role' });
    }

    // Update the manual player to link to parent
    const [updatedManualPlayer] = await db
      .update(manualPlayers)
      .set({
        linkedParentId: parentId,
        linkedBy: user.id,
        linkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualPlayers.id, manualPlayerId))
      .returning();

    if (!updatedManualPlayer) {
      return res.status(404).json({ error: 'Manual player not found' });
    }

    res.json({ message: 'Manual player linked to parent successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error linking manual player to parent:', error);
    res.status(500).json({ error: 'Failed to link manual player to parent' });
  }
});

// Unlink manual player from parent (admin only)
router.patch('/admin/manual-players/:manualPlayerId/unlink-from-parent', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    
    // Check if user is admin
    if (user.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update the manual player to remove the parent link
    const [updatedManualPlayer] = await db
      .update(manualPlayers)
      .set({
        linkedParentId: null,
        linkedBy: null,
        linkedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(manualPlayers.id, manualPlayerId))
      .returning();

    if (!updatedManualPlayer) {
      return res.status(404).json({ error: 'Manual player not found' });
    }

    res.json({ message: 'Manual player unlinked from parent successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error unlinking manual player from parent:', error);
    res.status(500).json({ error: 'Failed to unlink manual player from parent' });
  }
});

export default router;