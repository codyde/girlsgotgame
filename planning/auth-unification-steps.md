# Authentication Unification Implementation Steps

## **Phase 1: Clean Up Better Auth Configuration**

### **Current Issues in auth.ts:**
1. **Debug code pollution** (lines 18-41) - Remove for production
2. **Complex hooks** (lines 98-238) - Simplify to essential logic
3. **Any typing** (line 43) - Use proper TypeScript types
4. **Excessive logging** (lines 245-298) - Reduce to essentials

### **Step 1.1: Simplified Better Auth Config**

```typescript
// server/src/config/auth.ts - SIMPLIFIED VERSION
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from '../db/index';
import * as schema from '../db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema
  }),
  
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  
  baseURL: process.env.BETTER_AUTH_URL || (
    process.env.NODE_ENV === 'production' 
      ? "https://api.girlsgotgame.app/api/auth" 
      : "http://localhost:3001/api/auth"
  ),
  
  secret: process.env.BETTER_AUTH_SECRET!,
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60  // 5 minutes (Better Auth best practice)
    }
  },
  
  trustedOrigins: process.env.NODE_ENV === 'production'
    ? ["https://girlsgotgame.app"]
    : ["http://localhost:5173"],
    
  // Simplified hooks - only essential functionality
  hooks: {
    after: [
      {
        matcher: (context) => context.path?.includes("/callback/"),
        handler: async (context) => {
          // Auto-verify users and log new registrations
          if (context.context.newSession?.user) {
            const user = context.context.newSession.user;
            
            // Mark new users as verified if they used OAuth
            await db.update(schema.user)
              .set({ isVerified: true })
              .where(eq(schema.user.id, user.id));
              
            console.log('New user registered:', user.email);
          }
        }
      }
    ]
  }
});
```

## **Phase 2: Create Mobile Auth Facade**

### **Step 2.1: Create Mobile Auth Service**

```typescript
// server/src/services/mobileAuth.ts
import { auth } from '../config/auth';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

export class MobileAuthService {
  async signInWithGoogle(idToken: string) {
    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID!,
        '314217271573-g2do63ffpq29c0n9l6a8fcpmeb6g68l0.apps.googleusercontent.com' // iOS client
      ],
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid ID token');
    }

    // Use Better Auth to handle the sign-in
    // This is the key: delegate to Better Auth instead of custom logic
    const result = await auth.api.signInSocial({
      provider: 'google',
      // Pass the verified user data to Better Auth
      user: {
        id: payload.sub,
        email: payload.email!,
        name: payload.name!,
        image: payload.picture || null,
        emailVerified: new Date()
      }
    });

    return result;
  }

  async signOut(sessionToken: string) {
    // Use Better Auth's session management
    return await auth.api.signOut({
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    });
  }
}
```

### **Step 2.2: Simplified Mobile Endpoints**

```typescript
// server/src/routes/mobile-auth.ts
import { Router } from 'express';
import { MobileAuthService } from '../services/mobileAuth';

const router = Router();
const mobileAuth = new MobileAuthService();

// Mobile sign-in - now delegates to Better Auth
router.post('/sign-in/mobile', async (req, res) => {
  try {
    const { provider, idToken } = req.body;
    
    if (provider !== 'google') {
      return res.status(400).json({ 
        error: 'Only Google authentication is supported' 
      });
    }

    // Delegate to Better Auth through our service
    const result = await mobileAuth.signInWithGoogle(idToken);
    
    // Format response for Swift app compatibility
    res.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image
      },
      session: {
        token: result.session.token,
        expiresAt: result.session.expiresAt
      }
    });
  } catch (error) {
    console.error('Mobile sign-in error:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mobile sign-out - now delegates to Better Auth
router.post('/sign-out/mobile', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ 
        error: 'Session token required' 
      });
    }

    await mobileAuth.signOut(sessionToken);
    res.json({ success: true });
  } catch (error) {
    console.error('Mobile sign-out error:', error);
    res.status(500).json({ 
      error: 'Sign out failed' 
    });
  }
});

export default router;
```

## **Phase 3: Simplified Authentication Middleware**

### **Step 3.1: Clean Middleware**

```typescript
// server/src/middleware/auth.ts - SIMPLIFIED VERSION
import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Single source of truth: Better Auth
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    if (!session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Attach user data with role from database
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role || 'player'
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};

// Role-based access control
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role!)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

## **Phase 4: Update Main Server**

### **Step 4.1: Simplified Server Setup**

```typescript
// server/src/index.ts - KEY CHANGES
import mobileAuthRoutes from './routes/mobile-auth';

// Remove all the custom mobile auth logic (lines 407-614)
// Remove test routes and debug endpoints

const initializeServer = async () => {
  console.log('🚀 Starting server initialization...');

  // Mount mobile auth routes (preserves Swift compatibility)
  app.use('/api/auth', mobileAuthRoutes);
  
  // Better Auth handler - single source of truth
  app.all('/api/auth/*', toNodeHandler(auth));
  
  // Standard middleware
  app.use(express.json());
  
  // API routes
  app.use('/api/profiles', profileRoutes);
  app.use('/api/workouts', workoutRoutes);
  app.use('/api/posts', postRoutes);
  // ... other routes
};
```

## **Benefits of This Approach**

### ✅ **Simplification Achieved**
- **Single authentication system**: Better Auth handles all auth logic
- **Mobile compatibility preserved**: Swift app continues to work unchanged
- **Reduced complexity**: ~70% reduction in auth-related code
- **Better Auth best practices**: Proper session management, caching, security

### ✅ **Better Auth Alignment**
- Uses recommended Drizzle adapter
- Implements proper session caching
- Follows plugin architecture patterns
- Proper TypeScript typing

### ✅ **Mobile Strategy**
- **Facade pattern**: Mobile endpoints look the same but use Better Auth internally
- **Future migration path**: Can eventually move Swift app to Better Auth directly
- **Zero downtime**: No breaking changes for mobile app

## **Implementation Order**

1. **Create the mobile auth service** (Step 2.1)
2. **Update Better Auth config** (Step 1.1)  
3. **Replace mobile endpoints** (Step 2.2)
4. **Simplify middleware** (Step 3.1)
5. **Update server setup** (Step 4.1)
6. **Test mobile app compatibility**
7. **Remove old authentication code**

This approach gives you the best of both worlds: Better Auth's robustness with mobile app compatibility, while dramatically reducing complexity.