import { db } from '../db/index';
import { parentChildRelations, gamePlayers, manualPlayers, user as userTable, gameActivities } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import { getSocketIO } from '../lib/socket';

// Type definitions for common data structures
export interface GamePlayer {
  id: string;
  gameId: string;
  userId?: string;
  manualPlayerId?: string;
  jerseyNumber?: number;
  isStarter: boolean;
  minutesPlayed: number;
  userName?: string;
  manualPlayerName?: string;
}

export interface ActivityLogEntry {
  activityType: string;
  description: string;
  metadata?: any;
  performedBy: string;
}

/**
 * Check if a user has permission to access game data
 * Includes admin override, direct participation, and parent-child relationships
 */
export async function checkGamePermission(userId: string, gameId: string, isAdmin: boolean): Promise<boolean> {
  // Admins can access any game
  if (isAdmin) {
    return true;
  }

  // Check if user directly participated in the game
  const directParticipation = await db
    .select({ count: 1 })
    .from(gamePlayers)
    .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
    .where(
      or(
        eq(gamePlayers.userId, userId),
        eq(manualPlayers.linkedUserId, userId)
      )
    )
    .limit(1);

  if (directParticipation.length > 0) {
    return true;
  }

  // Check if user is a parent whose child participated
  const childRelations = await db
    .select({ childId: parentChildRelations.childId })
    .from(parentChildRelations)
    .where(eq(parentChildRelations.parentId, userId));

  if (childRelations.length === 0) {
    return false;
  }

  const childUserIds = childRelations.map(rel => rel.childId);
  
  const childParticipation = await db
    .select({ count: 1 })
    .from(gamePlayers)
    .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
    .where(
      or(
        ...childUserIds.map(childId => eq(gamePlayers.userId, childId)),
        ...childUserIds.map(childId => eq(manualPlayers.linkedUserId, childId))
      )
    )
    .limit(1);

  return childParticipation.length > 0;
}

/**
 * Get child user IDs for a parent user
 */
export async function getChildUserIds(parentId: string): Promise<string[]> {
  const childRelations = await db
    .select({ childId: parentChildRelations.childId })
    .from(parentChildRelations)
    .where(eq(parentChildRelations.parentId, parentId));
    
  return childRelations.map(rel => rel.childId);
}

/**
 * Resolve player name from either registered user or manual player
 */
export async function resolvePlayerName(userId?: string, manualPlayerId?: string): Promise<string> {
  if (userId) {
    const user = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    
    return user[0]?.name || 'Unknown User';
  }
  
  if (manualPlayerId) {
    const manualPlayer = await db
      .select({ name: manualPlayers.name })
      .from(manualPlayers)
      .where(eq(manualPlayers.id, manualPlayerId))
      .limit(1);
    
    return manualPlayer[0]?.name || 'Unknown Player';
  }
  
  return 'Unknown Player';
}

/**
 * Log game activity and emit to WebSocket clients
 */
export async function logGameActivity(
  gameId: string,
  activity: ActivityLogEntry,
  emitToSockets: boolean = true
): Promise<void> {
  // Insert activity log
  const [activityLog] = await db
    .insert(gameActivities)
    .values({
      gameId,
      activityType: activity.activityType,
      description: activity.description,
      metadata: activity.metadata ? JSON.stringify(activity.metadata) : null,
      performedBy: activity.performedBy,
    })
    .returning();

  // Emit to WebSocket clients if requested
  if (emitToSockets) {
    const io = getSocketIO();
    io.emit('gameActivity', {
      gameId,
      activity: {
        ...activityLog,
        metadata: activityLog.metadata ? JSON.parse(activityLog.metadata) : null,
      },
    });
  }
}

/**
 * Emit real-time update to WebSocket clients
 */
export function emitGameUpdate(gameId: string, updateType: string, data: any): void {
  const io = getSocketIO();
  io.emit('gameUpdate', {
    gameId,
    updateType,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Standard error response helper
 */
export function createErrorResponse(message: string, statusCode: number = 500) {
  return {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: any, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (!body[field] && body[field] !== 0) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Check if a user can modify stats (admin or player's parent)
 */
export async function canModifyStats(
  userId: string,
  isAdmin: boolean,
  targetUserId?: string
): Promise<boolean> {
  // Admins can modify any stats
  if (isAdmin) {
    return true;
  }

  // If no target user (manual player), only admins can modify
  if (!targetUserId) {
    return false;
  }

  // Users can modify their own stats
  if (userId === targetUserId) {
    return true;
  }

  // Check if user is a parent of the target player
  const childRelations = await db
    .select({ count: 1 })
    .from(parentChildRelations)
    .where(
      eq(parentChildRelations.parentId, userId),
      eq(parentChildRelations.childId, targetUserId)
    )
    .limit(1);

  return childRelations.length > 0;
}