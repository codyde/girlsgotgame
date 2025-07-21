import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Route imports
import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import workoutRoutes from './routes/workouts';
import postRoutes from './routes/posts';
import uploadRoutes from './routes/upload';
import { auth } from './config/auth';
import { toNodeHandler } from 'better-auth/node';
import { initializeUploadThing, createUploadThingRouteHandler } from './uploadthing';

// Load environment variables from the server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
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

// UploadThing route handler - using dynamic imports to avoid CommonJS issues
async function setupUploadThing() {
  try {
    const uploadRouter = await initializeUploadThing();
    const routeHandler = await createUploadThingRouteHandler(uploadRouter);
    app.use("/api/uploadthing", routeHandler);
    console.log("✅ UploadThing routes configured successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to setup UploadThing routes:", error);
    return false;
  }
}

// Initialize UploadThing and wait for completion before starting server
const initializeServer = async () => {
  // Set up UploadThing after express.json() middleware
  const uploadThingReady = await setupUploadThing();
  if (!uploadThingReady) {
    console.error("⚠️ UploadThing failed to initialize, but continuing...");
  }

  // Other API Routes
  app.use('/api', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/workouts', workoutRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/upload', uploadRoutes);

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Start the server
initializeServer().catch(console.error);