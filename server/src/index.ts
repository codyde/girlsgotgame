import './config/instrument';
import * as Sentry from "@sentry/node";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import fs from 'fs';
import crypto from 'crypto';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { setSocketIO } from './lib/socket';

// Route imports
import authRoutes from './routes/auth';
import mobileAuthRoutes from './routes/mobile-auth';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profiles';
import workoutRoutes from './routes/workouts';
import postRoutes from './routes/posts';
import uploadRoutes from './routes/upload';
import chatRoutes from './routes/chat';
import inviteRoutes from './routes/invites';
import gamesRoutes from './routes/games';
import mediaRoutes from './routes/media';
import reportsRoutes from './routes/reports';
import { auth } from './config/auth';
import { toNodeHandler } from 'better-auth/node';
import { db } from './db/index';
import { chatMessages, user, teamMembers, session } from './db/schema';
import { eq, and } from 'drizzle-orm';
// UploadThing removed - using Cloudflare R2 instead

// Load environment variables from the server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
Sentry.setupExpressErrorHandler(app);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://girlsgotgame.app']
      : ['http://localhost:5173'],
    credentials: true
  }
});

// Make socket.io instance available to routes
setSocketIO(io);

const PORT = process.env.PORT || 3001;

// Core middleware - order matters
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://girlsgotgame.app']
    : ['http://localhost:5173'],
  credentials: true
}));

// Request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Swagger API Documentation
try {
  const swaggerPath = path.join(__dirname, '../../swagger.yaml');
  if (fs.existsSync(swaggerPath)) {
    const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
    const swaggerDocument = yaml.parse(swaggerFile);
    
    const swaggerOptions = {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Girls Got Game API Documentation'
    };
    
    // Set up Swagger UI middleware and routes
    const swaggerServe = swaggerUi.serve;
    const swaggerSetup = swaggerUi.setup(swaggerDocument, swaggerOptions);
    
    // Serve Swagger UI at /api-docs (primary)
    app.use('/api-docs', swaggerServe);
    app.get('/api-docs', swaggerSetup);
    
    // Serve Swagger UI at /api for browser requests only
    app.use('/api', swaggerServe);
    app.get('/api', (req, res, next) => {
      // Only serve Swagger UI for browser requests (Accept: text/html)
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return swaggerSetup(req, res, next);
      }
      // For API requests, return a JSON response
      res.json({
        message: 'Girls Got Game API',
        documentation: `${req.protocol}://${req.get('host')}/api-docs`,
        version: '1.0.0',
        endpoints: {
          authentication: '/api/auth/*',
          profiles: '/api/profiles',
          workouts: '/api/workouts',
          posts: '/api/posts',
          chat: '/api/chat',
          upload: '/api/upload',
          invites: '/api/invites',
          games: '/api/games'
        }
      });
    });
    
    // Swagger UI configured successfully
  } else {
    // swagger.yaml not found - Swagger UI not available
  }
} catch (error) {
  console.error('❌ Error setting up Swagger UI:', error);
}

// Better Auth handler MUST come before express.json() middleware

// Handle Better Auth error page - redirect back to frontend with error
app.get('/api/auth/error', (req, res) => {
  const error = req.query.error;
  // Redirect back to frontend with error parameter
  res.redirect(`http://localhost:5173/?auth_error=${encodeURIComponent(error as string)}`);
});

// Mobile endpoint will be preserved and mounted inside initializeServer()

// Socket.IO authentication middleware
io.use(async (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Get session from cookies
    const sessionData = await auth.api.getSession({
      headers: socket.handshake.headers,
    });

    if (!sessionData?.user) {
      return next(new Error('Authentication required'));
    }

    // Attach user data to socket
    socket.data.user = sessionData.user;
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket: Socket) => {
  const user = socket.data.user;

  // Join user to their personal room for DMs
  socket.join(`user_${user.id}`);
  
  // Join user to their team rooms
  // TODO: Load user's team memberships and join those rooms
  
  // Handle joining a team room
  socket.on('join_team', (teamId: string) => {
    // TODO: Verify user is member of this team
    socket.join(`team_${teamId}`);
  });

  // Handle leaving a team room
  socket.on('leave_team', (teamId: string) => {
    socket.leave(`team_${teamId}`);
  });

  // Handle team message
  socket.on('team_message', async (data: { teamId: string; content: string }) => {
    try {
      // Verify user is a member of this team
      const membership = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, data.teamId), eq(teamMembers.userId, user.id)))
        .limit(1);

      if (membership.length === 0) {
        socket.emit('error', { message: 'Not a member of this team' });
        return;
      }

      // Save message to database
      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          senderId: user.id,
          teamId: data.teamId,
          recipientId: null,
          content: data.content,
          messageType: 'text',
        })
        .returning();

      const messageWithSender = {
        id: newMessage.id,
        senderId: user.id,
        senderName: user.name,
        teamId: data.teamId,
        content: data.content,
        messageType: 'text',
        createdAt: newMessage.createdAt.toISOString(),
      };
      
      // Broadcast to team room
      io.to(`team_${data.teamId}`).emit('team_message', messageWithSender);
    } catch (error) {
      console.error('Error saving team message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle direct message
  socket.on('direct_message', async (data: { recipientId: string; content: string }) => {
    try {
      
      // Validate recipientId
      if (!data.recipientId || typeof data.recipientId !== 'string' || data.recipientId.trim() === '') {
        socket.emit('error', { message: 'Invalid recipient ID' });
        return;
      }

      // Basic validation - just check if recipientId looks like a valid user ID format
      if (data.recipientId.trim().length < 10) {
        socket.emit('error', { message: 'Invalid recipient ID format' });
        return;
      }

      // Save message to database
      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          senderId: user.id,
          teamId: null,
          recipientId: data.recipientId.trim(),
          content: data.content,
          messageType: 'text',
        })
        .returning();

      const messageWithSender = {
        id: newMessage.id,
        senderId: user.id,
        senderName: user.name,
        recipientId: data.recipientId,
        content: data.content,
        messageType: 'text',
        createdAt: newMessage.createdAt.toISOString(),
      };
      
      // Send to recipient and sender
      io.to(`user_${data.recipientId}`).emit('direct_message', messageWithSender);
      io.to(`user_${user.id}`).emit('direct_message', messageWithSender);
    } catch (error) {
      console.error('Error saving direct message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data: { teamId?: string; recipientId?: string }) => {
    if (data.teamId) {
      socket.to(`team_${data.teamId}`).emit('user_typing', { userId: user.id, userName: user.name, teamId: data.teamId });
    } else if (data.recipientId) {
      socket.to(`user_${data.recipientId}`).emit('user_typing', { userId: user.id, userName: user.name, recipientId: data.recipientId });
    }
  });

  socket.on('typing_stop', (data: { teamId?: string; recipientId?: string }) => {
    if (data.teamId) {
      socket.to(`team_${data.teamId}`).emit('user_stop_typing', { userId: user.id, teamId: data.teamId });
    } else if (data.recipientId) {
      socket.to(`user_${data.recipientId}`).emit('user_stop_typing', { userId: user.id, recipientId: data.recipientId });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // User disconnected - no logging needed
  });
});

// Initialize server
const initializeServer = async () => {
  // 📱 BACKWARD COMPATIBILITY: Redirect old mobile endpoints to new paths
  app.post('/api/auth/sign-in/mobile', express.json(), async (req, res, next) => {
    // Forward to the new mobile auth service
    req.url = '/sign-in/mobile';
    mobileAuthRoutes(req, res, next);
  });
  
  app.post('/api/auth/sign-out/mobile', express.json(), async (req, res, next) => {
    // Forward to the new mobile auth service
    req.url = '/sign-out/mobile';
    mobileAuthRoutes(req, res, next);
  });
  
  // Mobile routes at new paths (for future iOS app updates)
  app.use('/api/mobile-auth', express.json(), mobileAuthRoutes);
  
  // Better Auth handler - handles remaining /api/auth/* (OAuth, sessions, etc.)
  app.all('/api/auth/*', toNodeHandler(auth));
  
  // JSON parsing middleware for all other routes
  app.use(express.json());
  
  // Custom auth utilities (session checking, user validation) 
  app.use('/api/auth-utils', authRoutes);

  // API routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/workouts', workoutRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/games', gamesRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/reports', reportsRoutes);

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  server.listen(portNumber, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server accessible at:`);
    console.log(`  - http://localhost:${PORT}`);
    console.log(`  - http://192.168.1.8:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Start the server
initializeServer().catch(console.error);