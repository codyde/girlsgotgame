import express from 'express';
import { eq, desc, gte, lte, and, like } from 'drizzle-orm';
import { db } from '../db/index';
import { workouts, user, posts, games, gamePlayers, gameStats, manualPlayers } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, experimental_transcribe as transcribe, generateObject } from 'ai';
import multer from 'multer';

// File polyfill for Node.js - required by @ai-sdk/openai internally
if (!globalThis.File) {
  globalThis.File = class File {
    constructor(fileBits, fileName, options = {}) {
      this.name = fileName;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
      
      // Handle different input types
      if (Buffer.isBuffer(fileBits)) {
        this._buffer = fileBits;
      } else if (Array.isArray(fileBits)) {
        this._buffer = Buffer.concat(fileBits.map(bit => Buffer.isBuffer(bit) ? bit : Buffer.from(bit)));
      } else {
        this._buffer = Buffer.from(fileBits);
      }
      
      this.size = this._buffer.length;
    }
    
    async arrayBuffer() {
      return this._buffer.buffer.slice(
        this._buffer.byteOffset,
        this._buffer.byteOffset + this._buffer.byteLength
      );
    }
    
    stream() {
      const { Readable } = require('stream');
      return Readable.from(this._buffer);
    }
    
    async text() {
      return this._buffer.toString();
    }
    
    slice(start = 0, end = this.size, contentType = '') {
      const slicedBuffer = this._buffer.slice(start, end);
      return new File([slicedBuffer], this.name, { type: contentType || this.type });
    }
  };
}

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
  listGames: {
    description: 'List all basketball games in the system. Shows game details including teams, dates, scores, and status. Can filter by opponent team name.',
    parameters: z.object({
      limit: z.number().optional().describe('Maximum number of games to return (default: 20)'),
      status: z.enum(['upcoming', 'live', 'completed', 'all']).optional().describe('Filter games by status (default: all)'),
      dateFilter: z.enum(['today', 'tomorrow', 'this_week', 'all']).optional().describe('Filter games by date (default: all)'),
      searchOpponentTeam: z.string().optional().describe('Filter games by opponent team name (partial match supported)'),
    }),
  },
  listPlayersInGame: {
    description: 'List all players participating in a specific basketball game. Shows both registered users and manual players.',
    parameters: z.object({
      gameId: z.string().describe('The UUID of the game to list players for'),
    }),
  },
  addStatsToPlayer: {
    description: 'Add statistical data to a player in a specific game. Can add points (2pt, 3pt, 1pt), steals, rebounds, etc.',
    parameters: z.object({
      gameId: z.string().describe('The UUID of the game'),
      gamePlayerId: z.string().describe('The UUID of the game player (from listPlayersInGame)'),
      statType: z.enum(['2pt', '3pt', '1pt', 'steal', 'rebound', 'assist', 'block', 'turnover']).describe('Type of statistic to add'),
      value: z.number().optional().describe('Value of the statistic (default: 1)'),
      quarter: z.number().optional().describe('Quarter/period when stat occurred (1-4)'),
      timeMinute: z.number().optional().describe('Minute mark when stat occurred (0-12 for each quarter)'),
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

// AI Chat endpoint with tool calling - Admin only
router.post('/ai', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user is admin
    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { message, conversationId } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get recent data for context
    const [recentGames, recentPosts, userStats] = await Promise.all([
      // Recent games
      db.select().from(games).orderBy(desc(games.createdAt)).limit(10),
      
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

1. Answer questions about app data (games, users, stats)
2. Help create new basketball games using the createGame tool
3. List all games in the system using the listGames tool
4. List players in a specific game using the listPlayersInGame tool
5. Add statistics to players in games using the addStatsToPlayer tool

CRITICAL TOOL USAGE RULES:
- When user asks about "games today", "upcoming games", "list games" → ALWAYS use listGames tool
- When user mentions team name like "Lakers game", "vs Warriors" → use listGames with searchOpponentTeam
- When user asks about "players in [team] game" → use listGames first to find the game, then inform user to ask for players with the Game ID
- When user wants to "add stats" or record statistics → use addStatsToPlayer tool if you have Game ID and Player ID
- For natural language stat recording → guide user through steps: find game → find player → add stat
- DO NOT use the context data for game information - ALWAYS call the appropriate tool
- The context data is outdated - tools provide current, detailed information

MULTI-STEP WORKFLOW GUIDANCE:
- If user asks "players in Lakers game" → call listGames with searchOpponentTeam: 'Lakers' and then tell user the Game ID and ask them to request players for that specific game
- If user says "John scored against Lakers" → first call listGames to find Lakers game, then guide user to next step
- Break complex requests into steps and guide the user through each one

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

GAME MANAGEMENT TOOLS:
- ALWAYS use listGames when user asks about games (today, upcoming, all games, etc.)
- ALWAYS use listPlayersInGame when user asks about players in a specific game
- ALWAYS use addStatsToPlayer when user wants to add statistics to a player
- Include Game IDs and Player IDs in responses for future reference
- Show team names clearly so users can identify which games to work with

NATURAL LANGUAGE PATTERNS & TOOL CHAINING:

GAME QUERIES:
- "games today" → listGames with dateFilter: 'today'
- "games against Lakers" → listGames with searchOpponentTeam: 'Lakers'
- "players in the Lakers game" → listGames with searchOpponentTeam: 'Lakers' → get gameId → listPlayersInGame
- "show players vs Warriors" → listGames with searchOpponentTeam: 'Warriors' → listPlayersInGame

STAT RECORDING PATTERNS:
- "{player} scored {X} points against {team}" → find game vs {team} → find {player} → addStatsToPlayer with '2pt' or '3pt'
- "{player} made a 3pt against {team}" → find game vs {team} → find {player} → addStatsToPlayer with '3pt'
- "{player} rebounded against {team}" → find game vs {team} → find {player} → addStatsToPlayer with 'rebound' 
- "{player} stole against {team}" → find game vs {team} → find {player} → addStatsToPlayer with 'steal'
- "{player} made a freethrow vs {team}" → find game vs {team} → find {player} → addStatsToPlayer with '1pt'

STAT TYPE MAPPING:
- "scored X points", "scored X" → determine '2pt' or '3pt' based on context/points
- "3pt", "three pointer", "made a 3" → '3pt'
- "freethrow", "free throw", "foul shot" → '1pt'
- "rebound", "rebounded" → 'rebound'
- "steal", "stole" → 'steal'
- "assist" → 'assist'
- "block", "blocked" → 'block'
- "turnover" → 'turnover'

TOOL CHAINING WORKFLOW:
1. When user mentions team name without game ID → call listGames with searchOpponentTeam
2. When user mentions player + team → find game first, then find player in that game
3. For stat recording → chain: find game → find player → add stat
4. Always show intermediate results to user (game found, player found, stat added)

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
          toolAction: z.enum(['none', 'createGame', 'listGames', 'listPlayersInGame', 'addStatsToPlayer']).describe('Which tool action to perform'),
          toolParams: z.object({
            // Game creation params
            teamName: z.string().optional(),
            opponentTeam: z.string().optional(),
            gameDate: z.string().optional(),
            isHome: z.boolean().optional(),
            notes: z.string().optional(),
            // List games params
            limit: z.number().optional(),
            status: z.enum(['upcoming', 'live', 'completed', 'all']).optional(),
            dateFilter: z.enum(['today', 'tomorrow', 'this_week', 'all']).optional(),
            searchOpponentTeam: z.string().optional(),
            // List players params
            gameId: z.string().optional(),
            // Add stats params
            gamePlayerId: z.string().optional(),
            statType: z.enum(['2pt', '3pt', '1pt', 'steal', 'rebound', 'assist', 'block', 'turnover']).optional(),
            value: z.number().optional(),
            quarter: z.number().optional(),
            timeMinute: z.number().optional(),
          }).optional().describe('Parameters for the tool action')
        }),
      });

      console.log('AI result:', result.object);

      // Handle tool actions
      if (result.object.toolAction && result.object.toolAction !== 'none' && result.object.toolParams) {
        const action = result.object.toolAction;
        const params = result.object.toolParams;
        
        try {
          switch (action) {
            case 'createGame': {
              if (!params.teamName || !params.opponentTeam || !params.gameDate || params.isHome === undefined) {
                res.json({
                  response: '❌ Missing required parameters for game creation. Need teamName, opponentTeam, gameDate, and isHome.',
                  timestamp: new Date().toISOString()
                });
                return;
              }
              
              console.log('Creating game with params:', params);
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
            }
            
            case 'listGames': {
              const limit = params.limit || 20;
              const status = params.status || 'all';
              const dateFilter = params.dateFilter || 'all';
              const opponentFilter = params.searchOpponentTeam;
              
              let query = db.select().from(games);
              const conditions = [];
              
              // Add status filter
              if (status !== 'all') {
                conditions.push(eq(games.status, status));
              }
              
              // Add opponent team filter
              if (opponentFilter) {
                conditions.push(like(games.opponentTeam, `%${opponentFilter}%`));
              }
              
              // Add date filter
              if (dateFilter !== 'all') {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                switch (dateFilter) {
                  case 'today': {
                    const todayEnd = new Date(today);
                    todayEnd.setDate(todayEnd.getDate() + 1);
                    conditions.push(gte(games.gameDate, today));
                    conditions.push(lte(games.gameDate, todayEnd));
                    break;
                  }
                  case 'tomorrow': {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowEnd = new Date(tomorrow);
                    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
                    conditions.push(gte(games.gameDate, tomorrow));
                    conditions.push(lte(games.gameDate, tomorrowEnd));
                    break;
                  }
                  case 'this_week': {
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    conditions.push(gte(games.gameDate, today));
                    conditions.push(lte(games.gameDate, weekEnd));
                    break;
                  }
                }
              }
              
              // Apply conditions if any
              if (conditions.length > 0) {
                query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
              }
              
              const gamesList = await query
                .orderBy(desc(games.gameDate))
                .limit(limit);
              
              const gamesInfo = gamesList.map(game => {
                const gameDate = new Date(game.gameDate);
                const formattedDate = gameDate.toLocaleDateString();
                const formattedTime = gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return `🏀 **${game.teamName}** vs **${game.opponentTeam}**
  📍 ${game.isHome ? 'Home Game' : 'Away Game'}
  📅 ${formattedDate} at ${formattedTime}
  📊 Status: ${game.status}${game.homeScore !== null ? ` | Final Score: ${game.homeScore}-${game.awayScore}` : ''}
  🆔 Game ID: \`${game.id}\`${game.notes ? `\n  📝 Notes: ${game.notes}` : ''}`;
              });
              
              const responseText = gamesList.length > 0 
                ? `📋 **Found ${gamesList.length} games:**\n\n${gamesInfo.join('\n\n')}`
                : '📋 No games found matching your criteria.';
              
              res.json({
                response: responseText,
                toolUsed: 'listGames',
                data: gamesList,
                timestamp: new Date().toISOString()
              });
              return;
            }
            
            case 'listPlayersInGame': {
              if (!params.gameId) {
                res.json({
                  response: '❌ Game ID is required to list players.',
                  timestamp: new Date().toISOString()
                });
                return;
              }
              
              // Get game info first
              const [gameInfo] = await db.select().from(games).where(eq(games.id, params.gameId));
              if (!gameInfo) {
                res.json({
                  response: '❌ Game not found with that ID.',
                  timestamp: new Date().toISOString()
                });
                return;
              }
              
              // Get players in game with user and manual player details
              const playersInGame = await db
                .select({
                  id: gamePlayers.id,
                  gameId: gamePlayers.gameId,
                  userId: gamePlayers.userId,
                  manualPlayerId: gamePlayers.manualPlayerId,
                  jerseyNumber: gamePlayers.jerseyNumber,
                  isStarter: gamePlayers.isStarter,
                  minutesPlayed: gamePlayers.minutesPlayed,
                  userName: user.name,
                  userEmail: user.email,
                  manualPlayerName: manualPlayers.name,
                  manualPlayerJersey: manualPlayers.jerseyNumber,
                })
                .from(gamePlayers)
                .leftJoin(user, eq(gamePlayers.userId, user.id))
                .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
                .where(eq(gamePlayers.gameId, params.gameId));
              
              const playersInfo = playersInGame.map(player => {
                const name = player.userName || player.manualPlayerName || 'Unknown Player';
                const jersey = player.jerseyNumber || player.manualPlayerJersey || 'No Jersey';
                const playerType = player.userId ? 'Registered User' : 'Manual Player';
                const starterStatus = player.isStarter ? '⭐ Starter' : 'Bench';
                
                return `• **${name}** (#${jersey})
  🆔 Player ID: ${player.id}
  👤 Type: ${playerType}
  📍 ${starterStatus}
  ⏱️ Minutes: ${player.minutesPlayed}`;
              });
              
              const responseText = playersInGame.length > 0
                ? `👥 **Players in ${gameInfo.teamName} vs ${gameInfo.opponentTeam}:**\n\n${playersInfo.join('\n\n')}`
                : `👥 **No players found for ${gameInfo.teamName} vs ${gameInfo.opponentTeam}**`;
              
              res.json({
                response: responseText,
                toolUsed: 'listPlayersInGame',
                data: playersInGame,
                timestamp: new Date().toISOString()
              });
              return;
            }
            
            case 'addStatsToPlayer': {
              if (!params.gameId || !params.gamePlayerId || !params.statType) {
                res.json({
                  response: '❌ Missing required parameters. Need gameId, gamePlayerId, and statType.',
                  timestamp: new Date().toISOString()
                });
                return;
              }
              
              // Verify game exists
              const [gameInfo] = await db.select().from(games).where(eq(games.id, params.gameId));
              if (!gameInfo) {
                res.json({
                  response: '❌ Game not found with that ID.',
                  timestamp: new Date().toISOString()
                });
                return;
              }
              
              // Verify player exists in game
              const [playerInfo] = await db
                .select({
                  id: gamePlayers.id,
                  userName: user.name,
                  manualPlayerName: manualPlayers.name,
                })
                .from(gamePlayers)
                .leftJoin(user, eq(gamePlayers.userId, user.id))
                .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
                .where(eq(gamePlayers.id, params.gamePlayerId));
                
              if (!playerInfo) {
                res.json({
                  response: '❌ Player not found in this game.',
                  timestamp: new Date().toISOString()
                });
                return;
              }
              
              // Add the stat
              const [newStat] = await db
                .insert(gameStats)
                .values({
                  gameId: params.gameId,
                  gamePlayerId: params.gamePlayerId,
                  statType: params.statType,
                  value: params.value || 1,
                  quarter: params.quarter || null,
                  timeMinute: params.timeMinute || null,
                  createdBy: req.user!.id, // Admin user adding the stat
                })
                .returning();
              
              const playerName = playerInfo.userName || playerInfo.manualPlayerName || 'Unknown Player';
              const statDescription = `${params.statType}${params.value && params.value !== 1 ? ` (${params.value})` : ''}`;
              const timeInfo = params.quarter && params.timeMinute 
                ? ` in Q${params.quarter} at ${params.timeMinute}:00`
                : params.quarter 
                  ? ` in Q${params.quarter}`
                  : '';
              
              res.json({
                response: `✅ **Stat added successfully!**\n📊 ${playerName}: ${statDescription}${timeInfo}\n🆔 Stat ID: ${newStat.id}`,
                toolUsed: 'addStatsToPlayer',
                data: newStat,
                timestamp: new Date().toISOString()
              });
              return;
            }
            
            default:
              res.json({
                response: result.object.response,
                timestamp: new Date().toISOString()
              });
              return;
          }
        } catch (dbError) {
          console.error(`Database error for ${action}:`, dbError);
          res.json({
            response: `❌ Sorry, there was an error performing the ${action} operation. Please try again.`,
            error: 'Database error',
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // If no tool action, send regular response
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
    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Use Vercel AI SDK transcribe with Buffer directly
    // The AI SDK expects Buffer, Uint8Array, ArrayBuffer, or base64 string
    const { text } = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: req.file.buffer, // Pass Buffer directly - this is what AI SDK expects
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