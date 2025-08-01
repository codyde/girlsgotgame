import express from 'express';
import { db } from '../db/index';
import { manualPlayers, user as userTable } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
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

export default router;