import express from 'express';
import { eq, and, or, desc, asc, isNull, ilike } from 'drizzle-orm';
import { db } from '../db/index';
import { teams, teamMembers, chatMessages, user } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  teamId: z.string().uuid().optional(),
  recipientId: z.string().optional(),
});

const joinTeamSchema = z.object({
  teamId: z.string().uuid(),
});

// Get all teams for the current user
router.get('/teams', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        createdBy: teams.createdBy,
        createdAt: teams.createdAt,
        role: teamMembers.role,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .orderBy(asc(teams.name));

    res.json(userTeams);
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create a new team
router.post('/teams', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, description } = createTeamSchema.parse(req.body);

    const [newTeam] = await db
      .insert(teams)
      .values({
        name,
        description,
        createdBy: userId,
      })
      .returning();

    // Add creator as admin member
    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId,
      role: 'admin',
    });

    res.json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Join a team
router.post('/teams/join', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { teamId } = joinTeamSchema.parse(req.body);

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (existingMembership.length > 0) {
      return res.status(400).json({ error: 'Already a member of this team' });
    }

    // Add user to team
    await db.insert(teamMembers).values({
      teamId,
      userId,
      role: 'member',
    });

    res.json({ message: 'Successfully joined team' });
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

// Get team messages
router.get('/teams/:teamId/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const teamId = req.params.teamId;

    // Verify user is a member of this team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this team' });
    }

    // Get messages with sender info
    const messages = await db
      .select({
        id: chatMessages.id,
        content: chatMessages.content,
        messageType: chatMessages.messageType,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
        senderName: user.name,
        senderAvatar: user.avatarUrl,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.senderId, user.id))
      .where(eq(chatMessages.teamId, teamId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(100);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching team messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get DM history with a specific user
router.get('/messages/dm/:otherUserId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const otherUserId = req.params.otherUserId;

    // Get DM messages between these two users
    const messages = await db
      .select({
        id: chatMessages.id,
        content: chatMessages.content,
        messageType: chatMessages.messageType,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
        recipientId: chatMessages.recipientId,
        senderName: user.name,
        senderAvatar: user.avatarUrl,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.senderId, user.id))
      .where(
        and(
          isNull(chatMessages.teamId), // DMs have null teamId
          or(
            and(eq(chatMessages.senderId, userId), eq(chatMessages.recipientId, otherUserId)),
            and(eq(chatMessages.senderId, otherUserId), eq(chatMessages.recipientId, userId))
          )
        )
      )
      .orderBy(asc(chatMessages.createdAt))
      .limit(100);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching DM messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message (team or DM)
router.post('/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { content, teamId, recipientId } = sendMessageSchema.parse(req.body);

    if (!teamId && !recipientId) {
      return res.status(400).json({ error: 'Must specify either teamId or recipientId' });
    }

    if (teamId && recipientId) {
      return res.status(400).json({ error: 'Cannot specify both teamId and recipientId' });
    }

    // If team message, verify membership
    if (teamId) {
      const membership = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      if (membership.length === 0) {
        return res.status(403).json({ error: 'Not a member of this team' });
      }
    }

    // Save message to database
    const [newMessage] = await db
      .insert(chatMessages)
      .values({
        senderId: userId,
        teamId: teamId || null,
        recipientId: recipientId || null,
        content,
        messageType: 'text',
      })
      .returning();

    // Get sender info for response
    const [sender] = await db
      .select({ name: user.name, avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, userId));

    const messageWithSender = {
      ...newMessage,
      senderName: sender.name,
      senderAvatar: sender.avatarUrl,
    };

    res.json(messageWithSender);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Search users for DM
router.get('/users/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.length < 3) {
      return res.json([]);
    }

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      })
      .from(user)
      .where(
        or(
          ilike(user.name, `%${query}%`),
          ilike(user.email, `%${query}%`)
        )
      )
      .limit(10);

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Admin endpoints for team management
router.get('/admin/teams', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user is admin (you might want to add proper admin middleware)
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        createdBy: teams.createdBy,
        createdAt: teams.createdAt,
        memberCount: teamMembers.id, // Will be aggregated
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .orderBy(asc(teams.name));

    // Group by team and count members
    const teamsWithCounts = allTeams.reduce((acc, team) => {
      const existing = acc.find(t => t.id === team.id);
      if (existing) {
        existing.memberCount += 1;
      } else {
        acc.push({
          id: team.id,
          name: team.name,
          description: team.description,
          createdBy: team.createdBy,
          createdAt: team.createdAt,
          memberCount: team.memberCount ? 1 : 0,
        });
      }
      return acc;
    }, [] as any[]);

    res.json(teamsWithCounts);
  } catch (error) {
    console.error('Error fetching admin teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/admin/teams/:teamId/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const teamId = req.params.teamId;
    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        userName: user.name,
        userEmail: user.email,
        userAvatar: user.avatarUrl,
      })
      .from(teamMembers)
      .innerJoin(user, eq(teamMembers.userId, user.id))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(user.name));

    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

router.post('/admin/teams/:teamId/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const teamId = req.params.teamId;
    const { userId, role = 'member' } = req.body;

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (existingMembership.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this team' });
    }

    await db.insert(teamMembers).values({
      teamId,
      userId,
      role,
    });

    res.json({ message: 'User added to team successfully' });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

router.delete('/admin/teams/:teamId/members/:memberId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const memberId = req.params.memberId;

    await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, memberId));

    res.json({ message: 'User removed from team successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

router.delete('/admin/teams/:teamId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const teamId = req.params.teamId;

    // Delete team members first (foreign key constraint)
    await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
    
    // Delete chat messages
    await db.delete(chatMessages).where(eq(chatMessages.teamId, teamId));
    
    // Delete team
    await db.delete(teams).where(eq(teams.id, teamId));

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;