import express from 'express';
import { eq, and, or, desc, asc, isNull, ilike, ne, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { teams, teamMembers, chatMessages, user, workouts, posts, games } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, experimental_transcribe as transcribe, generateObject } from 'ai';
import multer from 'multer';

// Configure OpenAI
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tool definitions for OpenAI function calling
const tools = {
  createGame: {
    description: 'Create a new basketball game. Requires team name, whether it\'s a home game, opponent team, game date, and game time.',
    parameters: z.object({
      teamName: z.string().describe('The name of our team playing in the game'),
      isHome: z.boolean().describe('Whether this is a home game (true) or away game (false)'),
      opponentTeam: z.string().describe('The name of the opposing team'),
      gameDate: z.string().describe('The date and time of the game in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). Must include both date and time.'),
      notes: z.string().optional().describe('Optional notes about the game'),
    }),
  },
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
  },
});

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

    // Get messages with sender info (limit to last 50 for performance)
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
      .limit(50);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching team messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get team members (for team members)
router.get('/teams/:teamId/members', requireAuth, async (req: AuthenticatedRequest, res) => {
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

    // Get all team members with user info
    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        userName: user.name,
        userEmail: user.email,
        userAvatar: user.avatarUrl,
        userRole: user.role,
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

// Get DM history with a specific user
router.get('/messages/dm/:otherUserId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const otherUserId = req.params.otherUserId;

    // Get DM messages between these two users (unlimited history)
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
      .orderBy(asc(chatMessages.createdAt));

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
// Get DM conversations for the current user with last message preview
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get all DM messages for this user
    const dmMessages = await db
      .select({
        messageId: chatMessages.id,
        senderId: chatMessages.senderId,
        recipientId: chatMessages.recipientId,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
        senderName: user.name,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.senderId, user.id))
      .where(
        and(
          isNull(chatMessages.teamId), // DMs only
          or(
            eq(chatMessages.senderId, userId),
            eq(chatMessages.recipientId, userId)
          )
        )
      )
      .orderBy(desc(chatMessages.createdAt));

    // Process messages to get unique conversations with last message
    const conversationMap = new Map();
    
    for (const message of dmMessages) {
      const otherUserId = message.senderId === userId ? message.recipientId : message.senderId;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          otherUserId,
          lastMessage: message,
        });
      }
    }

    // Get user details for each conversation
    const conversationIds = Array.from(conversationMap.keys());
    if (conversationIds.length === 0) {
      return res.json([]);
    }

    const conversationUsers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      })
      .from(user)
      .where(or(...conversationIds.map(id => eq(user.id, id))));

    // Combine user data with last message
    const conversations = conversationUsers.map(user => {
      const conversation = conversationMap.get(user.id);
      const lastMessage = conversation.lastMessage;
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        lastMessageContent: lastMessage.content,
        lastMessageSenderName: lastMessage.senderId === userId ? 'You' : lastMessage.senderName,
        lastMessageTime: lastMessage.createdAt,
      };
    });

    // Sort by most recent message
    conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching DM conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

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
        userRole: user.role,
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

// AI Chat endpoint with tool calling - Admin only
router.post('/ai', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { message, conversationId } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get recent data for context
    const [recentGames, recentWorkouts, recentPosts, userStats] = await Promise.all([
      // Recent games
      db.select().from(games).orderBy(desc(games.createdAt)).limit(10),
      
      // Recent workouts
      db.select({
        id: workouts.id,
        userId: workouts.userId,
        type: workouts.exerciseType,
        duration: workouts.durationMinutes,
        points: workouts.pointsEarned,
        createdAt: workouts.createdAt,
        userName: user.name
      })
      .from(workouts)
      .innerJoin(user, eq(workouts.userId, user.id))
      .orderBy(desc(workouts.createdAt))
      .limit(20),
      
      // Recent posts
      db.select({
        id: posts.id,
        userId: posts.userId,
        content: posts.content,
        createdAt: posts.createdAt,
        userName: user.name
      })
      .from(posts)
      .innerJoin(user, eq(posts.userId, user.id))
      .orderBy(desc(posts.createdAt))
      .limit(10),
      
      // User statistics
      db.select({
        id: user.id,
        name: user.name,
        role: user.role,
        points: user.totalPoints,
        createdAt: user.createdAt
      })
      .from(user)
      .orderBy(desc(user.totalPoints))
      .limit(10)
    ]);

    // Prepare context for AI
    const context = {
      recentGames: recentGames.map(game => ({
        id: game.id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        date: game.gameDate,
        status: game.status
      })),
      recentWorkouts: recentWorkouts.map(workout => ({
        type: workout.type,
        duration: workout.duration,
        points: workout.points,
        user: workout.userName,
        date: workout.createdAt
      })),
      recentPosts: recentPosts.map(post => ({
        content: post.content,
        user: post.userName,
        date: post.createdAt
      })),
      topUsers: userStats.map(u => ({
        name: u.name,
        role: u.role,
        points: u.points,
        joinedAt: u.createdAt
      }))
    };

    const systemPrompt = `You are an AI assistant for Girls Got Game, a basketball training app. You can:

1. Answer questions about app data (games, workouts, users, stats)
2. Help create new basketball games using the createGame tool

CRITICAL RULES FOR GAME CREATION:

Team Identification:
- When user says "create a game for [TEAM A] against [TEAM B]" → TEAM A = teamName, TEAM B = opponentTeam
- When user says "our [TEAM] team against [OPPONENT]" → TEAM = teamName, OPPONENT = opponentTeam
- When user says "[TEAM] vs [OPPONENT]" → TEAM = teamName, OPPONENT = opponentTeam
- Example: "YBA Pink against Davis Storm" → teamName: "YBA Pink", opponentTeam: "Davis Storm"

Location/Home-Away:
- "We're away" or "away game" → isHome: false
- "We're home" or "home game" → isHome: true
- "at their place" → isHome: false
- "at our place" → isHome: true

Date/Time Parsing:
- Convert dates to ISO format with current year (2025) if not specified
- Convert times like "8pm" or "8 o'clock p.m." to 24-hour format (20:00)
- Create full datetime: YYYY-MM-DDTHH:mm:ss.000Z
- Today is ${new Date().toISOString()}

TOOL CALLING RULES:
- IMMEDIATELY call createGame tool when you have ALL required information:
  * teamName (our team name)
  * opponentTeam (opposing team name)  
  * gameDate (complete ISO datetime)
  * isHome (true/false for home/away)
- Do NOT just say you will create the game - ACTUALLY call the createGame tool
- If ANY required info is missing, ask specific questions. Do NOT guess or assume.
- When you have complete info, call the tool immediately without additional explanation

Recent Data Context:
${JSON.stringify(context, null, 2)}

Be precise about team identification and only create games when you have complete information.`;

    // Try to use tool calling first - simplified approach
    try {
      const result = await generateObject({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        prompt: message,
        tools,
        maxToolRoundtrips: 5, // Reduced from 25 to avoid infinite loops
        schema: z.object({
          response: z.string().describe('The response to send to the user'),
          shouldCreateGame: z.boolean().describe('Whether a game should be created based on the conversation'),
          gameDetails: z.object({
            teamName: z.string(),
            opponentTeam: z.string(),
            gameDate: z.string(),
            isHome: z.boolean(),
            notes: z.string().optional()
          }).optional().describe('Game creation details if shouldCreateGame is true')
        }),
      });

      console.log('AI result:', result.object);

      // Check if we should create a game based on AI decision
      if (result.object.shouldCreateGame && result.object.gameDetails) {
        const params = result.object.gameDetails;
        console.log('Creating game with params:', params);
        try {
          const [newGame] = await db
            .insert(games)
            .values({
              teamName: params.teamName,
              isHome: params.isHome,
              opponentTeam: params.opponentTeam,
              gameDate: new Date(params.gameDate),
              notes: params.notes || null,
            })
            .returning();

          const gameDateTime = new Date(params.gameDate);
          const formattedDate = gameDateTime.toLocaleDateString();
          const formattedTime = gameDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          res.json({
            response: `✅ Game created successfully! ${params.teamName} vs ${params.opponentTeam} on ${formattedDate} at ${formattedTime} (${params.isHome ? 'Home' : 'Away'} game)`,
            toolUsed: 'createGame',
            gameId: newGame.id,
            timestamp: new Date().toISOString()
          });
          return;
        } catch (dbError) {
          console.error('Database error creating game:', dbError);
          res.json({
            response: '❌ Sorry, there was an error creating the game. Please try again.',
            error: 'Database error',
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // If no game creation, send regular response
      res.json({
        response: result.object.response,
        timestamp: new Date().toISOString()
      });

    } catch (toolError) {
      console.error('Tool calling error, falling back to streaming:', toolError);
      
      // Fallback to streaming response without tools
      const result = await streamText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        prompt: message,
        maxTokens: 500,
      });

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Stream the response
      result.pipeTextStreamToResponse(res);
    }

  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

// Audio transcription endpoint - Admin only
router.post('/transcribe', requireAuth, upload.single('audio'), async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Use Vercel AI SDK transcribe with proper Node.js Buffer handling
    const { text } = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: req.file.buffer, // Pass Buffer directly (not Uint8Array)
      providerOptions: {
        openai: {
          language: 'en',
        }
      }
    });

    res.json({
      text: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

export default router;