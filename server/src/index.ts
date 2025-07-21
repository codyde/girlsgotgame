import './config/instrument';
import * as Sentry from "@sentry/node";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

// Route imports
import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import workoutRoutes from './routes/workouts';
import postRoutes from './routes/posts';
import uploadRoutes from './routes/upload';
import chatRoutes from './routes/chat';
import inviteRoutes from './routes/invites';
import accessRequestRoutes from './routes/access-requests';
import adminRoutes from './routes/admin';
import { auth } from './config/auth';
import { toNodeHandler } from 'better-auth/node';
import { db } from './db/index';
import { chatMessages, user, teamMembers } from './db/schema';
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
      ? 'https://girlsgotgame.app'
      : ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3001;

// Middleware (but NOT express.json() yet - it interferes with Better Auth)
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://girlsgotgame.app'
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Better Auth handler MUST come before express.json() middleware
console.log('🔧 Mounting Better Auth at /api/auth/*');
console.log('🔧 Auth object:', typeof auth, !!auth.handler);

// Test route to verify routing works
app.get('/api/auth/test', (req, res) => {
  console.log('🔧 Test route hit!');
  res.json({ message: 'Better Auth test route working' });
});

// Test route to initiate Google OAuth using Better Auth API
app.get('/api/test-google-signin', async (req, res) => {
  console.log('🔧 Test Google sign-in redirect');
  try {
    // Try to use Better Auth API directly with proper context
    const result = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: 'http://localhost:5174/'
      },
      headers: req.headers as any
    });
    console.log('🔧 Better Auth result:', result);
    
    if (result.url) {
      res.redirect(result.url);
    } else {
      res.json({ result });
    }
  } catch (error) {
    console.error('🔴 Better Auth API error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Debug route to check verification table
app.get('/api/debug/verification', async (req, res) => {
  try {
    const { auth } = await import('./config/auth');
    console.log('🔧 Checking verification table');
    res.json({ message: 'OAuth is working! Check server logs for callback details.' });
  } catch (error) {
    console.error('🔴 Verification debug error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Handle Better Auth error page - redirect back to frontend with error
app.get('/api/auth/error', (req, res) => {
  const error = req.query.error;
  console.log('🔴 Better Auth error:', error);
  
  // Redirect back to frontend with error parameter
  res.redirect(`http://localhost:5174/?auth_error=${encodeURIComponent(error as string)}`);
});

// Handle Better Auth routes - use the standard toNodeHandler approach
app.all('/api/auth/*', async (req, res, next) => {
  console.log('🔧 Better Auth route hit:', req.method, req.url, req.path);
  console.log('🔧 Query params:', req.query);
  console.log('🔧 Headers:', req.headers.host, req.headers.referer);
  
  try {
    const handler = toNodeHandler(auth);
    console.log('🔧 Handler created, calling...');
    
    // Check response status after handler completes
    const originalSend = res.send;
    const originalJson = res.json;
    let responseData = null;
    
    res.send = function(data) {
      responseData = data;
      console.log('🔧 Response status:', res.statusCode, 'Data:', data);
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      responseData = data;
      console.log('🔧 Response status:', res.statusCode, 'JSON:', data);
      return originalJson.call(this, data);
    };
    
    const result = await handler(req, res);
    console.log('🔧 Handler completed, result:', result);
    return result;
  } catch (error) {
    console.error('🔴 Better Auth handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Better Auth handler failed', details: (error as Error).message });
    }
  }
});

// NOW add express.json() middleware for other routes
app.use(express.json());

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
  console.log(`User ${user.name} (${user.id}) connected to chat`);

  // Join user to their personal room for DMs
  socket.join(`user_${user.id}`);
  
  // Join user to their team rooms
  // TODO: Load user's team memberships and join those rooms
  
  // Handle joining a team room
  socket.on('join_team', (teamId: string) => {
    // TODO: Verify user is member of this team
    socket.join(`team_${teamId}`);
    console.log(`User ${user.name} joined team ${teamId}`);
  });

  // Handle leaving a team room
  socket.on('leave_team', (teamId: string) => {
    socket.leave(`team_${teamId}`);
    console.log(`User ${user.name} left team ${teamId}`);
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
      console.log(`Team message from ${user.name} to team ${data.teamId}: ${data.content}`);
    } catch (error) {
      console.error('Error saving team message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle direct message
  socket.on('direct_message', async (data: { recipientId: string; content: string }) => {
    try {
      // Verify recipient exists
      const recipient = await db
        .select()
        .from(user)
        .where(eq(user.id, data.recipientId))
        .limit(1);

      if (recipient.length === 0) {
        socket.emit('error', { message: 'Recipient not found' });
        return;
      }

      // Save message to database
      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          senderId: user.id,
          teamId: null,
          recipientId: data.recipientId,
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
      console.log(`DM from ${user.name} to ${data.recipientId}: ${data.content}`);
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
    console.log(`User ${user.name} (${user.id}) disconnected from chat`);
  });
});

// Initialize server
const initializeServer = async () => {

  // Other API Routes
  app.use('/api', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/workouts', workoutRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/access-requests', accessRequestRoutes);
  app.use('/api/admin', adminRoutes);

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Socket.IO enabled for real-time chat`);
  });
};

// Start the server
initializeServer().catch(console.error);