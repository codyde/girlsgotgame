import express from 'express';
import { db } from '../db/index';
import { manualPlayers, user as userTable, gamePlayers, gameStats } from '../db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { createErrorResponse, validateRequiredFields } from './games-utils';

const router = express.Router();

// Get all manual players (admin only)
router.get('/admin/manual-players', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const manualPlayersList = await db
      .select({
        id: manualPlayers.id,
        name: manualPlayers.name,
        jerseyNumber: manualPlayers.jerseyNumber,
        linkedUserId: manualPlayers.linkedUserId,
        linkedBy: manualPlayers.linkedBy,
        linkedAt: manualPlayers.linkedAt,
        notes: manualPlayers.notes,
        createdAt: manualPlayers.createdAt,
        updatedAt: manualPlayers.updatedAt,
        linkedUser: {
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
        }
      })
      .from(manualPlayers)
      .leftJoin(userTable, eq(manualPlayers.linkedUserId, userTable.id))
      .orderBy(asc(manualPlayers.name));

    res.json(manualPlayersList);
  } catch (error) {
    console.error('Error fetching manual players:', error);
    const errorResponse = createErrorResponse('Failed to fetch manual players', 500);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Link manual player to registered user (admin only)
router.patch('/admin/manual-players/:manualPlayerId/link', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;
    const { userId } = req.body;
    
    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['userId']);
    if (validationError) {
      const errorResponse = createErrorResponse(validationError, 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Verify the manual player exists before attempting to link
    const [existingManualPlayer] = await db
      .select({ id: manualPlayers.id })
      .from(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId))
      .limit(1);

    if (!existingManualPlayer) {
      const errorResponse = createErrorResponse('Manual player not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Verify the user exists before linking
    const [existingUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!existingUser) {
      const errorResponse = createErrorResponse('User not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
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
      const errorResponse = createErrorResponse('Failed to link manual player', 500);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    res.json({ message: 'Manual player linked successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error linking manual player:', error);
    const errorResponse = createErrorResponse('Failed to link manual player', 500);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Unlink manual player from registered user (admin only)
router.patch('/admin/manual-players/:manualPlayerId/unlink', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { manualPlayerId } = req.params;
    
    // Verify the manual player exists before attempting to unlink
    const [existingManualPlayer] = await db
      .select({ id: manualPlayers.id, linkedUserId: manualPlayers.linkedUserId })
      .from(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId))
      .limit(1);

    if (!existingManualPlayer) {
      const errorResponse = createErrorResponse('Manual player not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Check if the manual player is actually linked to a user
    if (!existingManualPlayer.linkedUserId) {
      const errorResponse = createErrorResponse('Manual player is not currently linked to any user', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
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
      const errorResponse = createErrorResponse('Failed to unlink manual player', 500);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    res.json({ message: 'Manual player unlinked successfully', manualPlayer: updatedManualPlayer });
  } catch (error) {
    console.error('Error unlinking manual player:', error);
    const errorResponse = createErrorResponse('Failed to unlink manual player', 500);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Migrate manual player data to registered user and delete manual entry (admin only)
router.post('/admin/manual-players/:manualPlayerId/migrate', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;

    // Get the manual player with all data
    const [manualPlayer] = await db
      .select()
      .from(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId))
      .limit(1);

    if (!manualPlayer) {
      const errorResponse = createErrorResponse('Manual player not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    if (!manualPlayer.linkedUserId) {
      const errorResponse = createErrorResponse('Manual player must be linked to a user before migration', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Verify the linked user exists
    const [targetUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, manualPlayer.linkedUserId))
      .limit(1);

    if (!targetUser) {
      const errorResponse = createErrorResponse('Linked user not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Collect migration statistics for verification
    const migrationStats = {
      userUpdated: false,
      gamePlayersToMigrate: 0,
      gamePlayersMigrated: 0,
      gameStatsToMigrate: 0,
      gameStatsMigrated: 0,
      duplicatesFound: 0,
      errors: []
    };

    // Start transaction for data migration
    await db.transaction(async (trx) => {
      console.log(`🚀 Starting migration for manual player ${manualPlayer.name} to user ${targetUser.email}`);
      console.log(`🔍 DEBUG: Manual player details:`, {
        id: manualPlayer.id,
        name: manualPlayer.name,
        linkedUserId: manualPlayer.linkedUserId,
        jerseyNumber: manualPlayer.jerseyNumber,
        createdAt: manualPlayer.createdAt
      });

      // Step 1: Update user account with manual player data
      try {
        const userUpdateData: any = { updatedAt: new Date() };
        
        // Only update jersey number if user doesn't have one
        if (!targetUser.jerseyNumber && manualPlayer.jerseyNumber) {
          userUpdateData.jerseyNumber = manualPlayer.jerseyNumber;
          console.log(`👕 Migrating jersey number: ${manualPlayer.jerseyNumber}`);
        }

        await trx
          .update(userTable)
          .set(userUpdateData)
          .where(eq(userTable.id, manualPlayer.linkedUserId));

        migrationStats.userUpdated = true;
        console.log(`✅ User profile updated successfully`);
      } catch (error) {
        console.error(`❌ Error updating user profile:`, error);
        migrationStats.errors.push(`User update failed: ${error}`);
      }

      // Step 2: Get all game player records to migrate
      console.log(`🔍 DEBUG: Searching for game players with manualPlayerId = ${manualPlayerId}`);
      
      // First, let's see ALL game player records for debugging
      const allGamePlayersForManual = await trx
        .select({
          id: gamePlayers.id,
          gameId: gamePlayers.gameId,
          userId: gamePlayers.userId,
          manualPlayerId: gamePlayers.manualPlayerId,
          jerseyNumber: gamePlayers.jerseyNumber
        })
        .from(gamePlayers)
        .where(eq(gamePlayers.manualPlayerId, manualPlayerId));

      console.log(`🔍 DEBUG: All game players with manualPlayerId ${manualPlayerId}:`, allGamePlayersForManual);
      
      // Also check if there are any game players with NULL manualPlayerId but linked to our target user
      const existingUserGamePlayers = await trx
        .select({
          id: gamePlayers.id,
          gameId: gamePlayers.gameId,
          userId: gamePlayers.userId,
          manualPlayerId: gamePlayers.manualPlayerId,
          jerseyNumber: gamePlayers.jerseyNumber
        })
        .from(gamePlayers)
        .where(eq(gamePlayers.userId, manualPlayer.linkedUserId));

      console.log(`🔍 DEBUG: Game players already linked to user ${manualPlayer.linkedUserId}:`, existingUserGamePlayers);

      // Check specifically for the problematic game
      const specificGameCheck = await trx
        .select({
          id: gamePlayers.id,
          gameId: gamePlayers.gameId,
          userId: gamePlayers.userId,
          manualPlayerId: gamePlayers.manualPlayerId,
          jerseyNumber: gamePlayers.jerseyNumber
        })
        .from(gamePlayers)
        .where(eq(gamePlayers.gameId, '91c1b920-5bfd-414a-8248-cd724a717e30'));

      console.log(`🔍 DEBUG: All game players for specific game 91c1b920-5bfd-414a-8248-cd724a717e30:`, specificGameCheck);

      // SPECIAL FIX: Look for game players where userId equals our manual player ID (data corruption)
      const corruptedGamePlayers = await trx
        .select({
          id: gamePlayers.id,
          gameId: gamePlayers.gameId,
          userId: gamePlayers.userId,
          manualPlayerId: gamePlayers.manualPlayerId,
          jerseyNumber: gamePlayers.jerseyNumber
        })
        .from(gamePlayers)
        .where(eq(gamePlayers.userId, manualPlayerId)); // Look for userId = manual player ID

      console.log(`🔍 DEBUG: Found ${corruptedGamePlayers.length} corrupted game players with userId = manualPlayerId:`, corruptedGamePlayers);

      // Fix corrupted records by updating them to point to the real user
      if (corruptedGamePlayers.length > 0) {
        console.log(`🔧 FIXING: Correcting ${corruptedGamePlayers.length} corrupted game player records`);
        for (const corruptedPlayer of corruptedGamePlayers) {
          await trx
            .update(gamePlayers)
            .set({
              userId: manualPlayer.linkedUserId, // Set to real user ID
              manualPlayerId: null, // Clear manual player reference
            })
            .where(eq(gamePlayers.id, corruptedPlayer.id));
          
          console.log(`✅ Fixed corrupted game player ${corruptedPlayer.id} for game ${corruptedPlayer.gameId}`);
          migrationStats.gamePlayersMigrated++;
        }
        migrationStats.gamePlayersToMigrate = corruptedGamePlayers.length;
      }

      const gamePlayersToMigrate = allGamePlayersForManual;
      migrationStats.gamePlayersToMigrate = gamePlayersToMigrate.length;
      console.log(`🎮 Found ${gamePlayersToMigrate.length} game player records to migrate`);

      // Check for potential duplicates - game players that already exist for this user
      for (const gamePlayer of gamePlayersToMigrate) {
        const existingGamePlayer = await trx
          .select()
          .from(gamePlayers)
          .where(
            and(
              eq(gamePlayers.gameId, gamePlayer.gameId),
              eq(gamePlayers.userId, manualPlayer.linkedUserId)
            )
          )
          .limit(1);

        if (existingGamePlayer.length > 0) {
          migrationStats.duplicatesFound++;
          console.log(`⚠️ Duplicate found: User already has a game player record for game ${gamePlayer.gameId}`);
          migrationStats.errors.push(`Duplicate game player for game ${gamePlayer.gameId} - skipped`);
          continue;
        }

        // Migrate this game player record
        try {
          await trx
            .update(gamePlayers)
            .set({
              userId: manualPlayer.linkedUserId,
              manualPlayerId: null, // Clear the manual player reference
            })
            .where(eq(gamePlayers.id, gamePlayer.id));

          migrationStats.gamePlayersMigrated++;
          console.log(`✅ Migrated game player record ${gamePlayer.id} for game ${gamePlayer.gameId}`);
        } catch (error) {
          console.error(`❌ Error migrating game player ${gamePlayer.id}:`, error);
          migrationStats.errors.push(`Game player ${gamePlayer.id} migration failed: ${error}`);
        }
      }

      // Step 3: Get and migrate game stats
      const gameStatsToMigrate = await trx
        .select({
          statId: gameStats.id,
          gamePlayerId: gameStats.gamePlayerId,
          statType: gameStats.statType,
          value: gameStats.value,
          gameId: gamePlayers.gameId
        })
        .from(gameStats)
        .innerJoin(gamePlayers, eq(gameStats.gamePlayerId, gamePlayers.id))
        .where(eq(gamePlayers.manualPlayerId, manualPlayerId));

      migrationStats.gameStatsToMigrate = gameStatsToMigrate.length;
      console.log(`📊 Found ${gameStatsToMigrate.length} game stats to migrate`);

      // Note: Game stats will automatically follow the game players since they reference gamePlayerId
      // We just need to count them for verification
      migrationStats.gameStatsMigrated = gameStatsToMigrate.length;
      
      if (gameStatsToMigrate.length > 0) {
        console.log(`✅ Game stats will automatically follow game players (${gameStatsToMigrate.length} stats)`);
      }

      // Step 4: FOR TESTING - Do NOT delete the manual player entry yet
      console.log(`🧪 TEST MODE: Manual player entry preserved for verification`);
      
      // Log final migration summary
      console.log(`🎉 Migration completed for ${manualPlayer.name}:`);
      console.log(`   - User updated: ${migrationStats.userUpdated}`);
      console.log(`   - Game players: ${migrationStats.gamePlayersMigrated}/${migrationStats.gamePlayersToMigrate} migrated`);
      console.log(`   - Game stats: ${migrationStats.gameStatsMigrated} will follow`);
      console.log(`   - Duplicates found: ${migrationStats.duplicatesFound}`);
      console.log(`   - Errors: ${migrationStats.errors.length}`);
    });

    // Determine migration success
    const isSuccessful = migrationStats.gamePlayersMigrated === migrationStats.gamePlayersToMigrate && migrationStats.errors.length === 0;
    
    res.json({ 
      message: isSuccessful 
        ? 'Manual player data migrated successfully (TEST MODE - manual entry preserved)' 
        : 'Migration completed with issues - check details',
      success: isSuccessful,
      migratedTo: {
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      },
      migrationStats: {
        userUpdated: migrationStats.userUpdated,
        gamePlayersFound: migrationStats.gamePlayersToMigrate,
        gamePlayersMigrated: migrationStats.gamePlayersMigrated,
        gameStatsFound: migrationStats.gameStatsToMigrate,
        gameStatsMigrated: migrationStats.gameStatsMigrated,
        duplicatesFound: migrationStats.duplicatesFound,
        errors: migrationStats.errors,
        summary: `${migrationStats.gamePlayersMigrated}/${migrationStats.gamePlayersToMigrate} game records migrated with ${migrationStats.duplicatesFound} duplicates skipped`
      }
    });
  } catch (error) {
    console.error('Error migrating manual player:', error);
    const errorResponse = createErrorResponse('Failed to migrate manual player data', 500);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Delete migrated manual player (admin only)
router.delete('/admin/manual-players/:manualPlayerId/delete-migrated', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;

    // Get the manual player
    const [manualPlayer] = await db
      .select()
      .from(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId))
      .limit(1);

    if (!manualPlayer) {
      const errorResponse = createErrorResponse('Manual player not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Safety check: Verify this manual player has been migrated (no game records reference it)
    const gamePlayersStillReferencing = await db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.manualPlayerId, manualPlayerId))
      .limit(1);

    if (gamePlayersStillReferencing.length > 0) {
      const errorResponse = createErrorResponse('Cannot delete: Manual player still has game records. Complete migration first.', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Safety check: Only delete if the manual player was linked to a user
    if (!manualPlayer.linkedUserId) {
      const errorResponse = createErrorResponse('Cannot delete: Manual player was never linked to a user. Use regular delete instead.', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Verify the target user actually exists and has data
    const [targetUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, manualPlayer.linkedUserId))
      .limit(1);

    if (!targetUser) {
      const errorResponse = createErrorResponse('Cannot delete: Linked user no longer exists', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Check if the target user has game records (proof of successful migration)
    const userGameRecords = await db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.userId, manualPlayer.linkedUserId))
      .limit(1);

    if (userGameRecords.length === 0) {
      const errorResponse = createErrorResponse('Cannot delete: Target user has no game records. Migration may not have been successful.', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // All safety checks passed - delete both the manual player and linked user
    await db
      .delete(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId));

    await db
      .delete(userTable)
      .where(eq(userTable.id, manualPlayer.linkedUserId));

    console.log(`🗑️ Manual player ${manualPlayer.name} and linked user deleted after successful migration by admin ${user.email}`);

    res.json({ 
      message: 'Migrated manual player and linked user deleted successfully',
      deletedPlayer: {
        id: manualPlayer.id,
        name: manualPlayer.name,
        wasLinkedTo: manualPlayer.linkedUserId
      }
    });
  } catch (error) {
    console.error('Error deleting migrated manual player:', error);
    const errorResponse = createErrorResponse('Failed to delete migrated manual player', 500);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Force delete manual player (admin only) - bypasses most safety checks
router.delete('/admin/manual-players/:manualPlayerId/force-delete', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { manualPlayerId } = req.params;

    // Get the manual player
    const [manualPlayer] = await db
      .select()
      .from(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId))
      .limit(1);

    if (!manualPlayer) {
      const errorResponse = createErrorResponse('Manual player not found', 404);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // ONLY safety check: Verify no game records still reference this manual player
    const gamePlayersStillReferencing = await db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.manualPlayerId, manualPlayerId))
      .limit(1);

    if (gamePlayersStillReferencing.length > 0) {
      const errorResponse = createErrorResponse('Cannot force delete: Manual player still has active game records. This would cause data corruption.', 400);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Force delete the manual player (no other safety checks)
    await db
      .delete(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId));

    console.log(`🚨 Manual player ${manualPlayer.name} FORCE DELETED by admin ${user.email}`);

    res.json({ 
      message: 'Manual player force deleted successfully',
      deletedPlayer: {
        id: manualPlayer.id,
        name: manualPlayer.name,
        wasLinkedTo: manualPlayer.linkedUserId
      }
    });
  } catch (error) {
    console.error('Error force deleting manual player:', error);
    const errorResponse = createErrorResponse('Failed to force delete manual player', 500);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;