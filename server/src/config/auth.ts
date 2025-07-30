import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/plugins";
import * as Sentry from "@sentry/node";
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { expo } from "@better-auth/expo";

// Import the schema for Better Auth
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

// Load environment variables from the server directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Debug environment variables
console.log('🔍 Environment variables check:');
console.log('BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL);
console.log('BETTER_AUTH_SECRET:', process.env.BETTER_AUTH_SECRET ? '[SET]' : '[NOT SET]');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '[SET]' : '[NOT SET]');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '[SET]' : '[NOT SET]');

// Create database connection specifically for Better Auth
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
const authDb = drizzle(client, { schema });

console.log('🔗 Testing database connection...');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

export const auth: any = betterAuth({
  plugins: [expo()],
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: schema
  }),

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET as string,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    }
  },
  trustedOrigins: process.env.NODE_ENV === 'production'
      ? ["https://girlsgotgame.app", "girlsgotgameios://"]
      : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3001", "girlsgotgameios://"],
  callbacks: {
    redirect: async (url: string, request: any) => {
      const { headers } = request;
      
      console.log('🔄 [BETTER AUTH] Redirect callback triggered:', {
        url,
        userAgent: headers['user-agent'],
        referer: headers['referer'],
        origin: headers['origin']
      });
      
      // Check if this is a mobile request by detecting CFNetwork user agent
      const isMobileRequest = headers['user-agent']?.includes('CFNetwork') ||
                         headers['user-agent']?.includes('GirlsGotGame');
      
      // For OAuth callbacks from mobile, redirect to mobile app
      if (isMobileRequest && url.includes('/')) {
        const mobileRedirect = 'girlsgotgameios://';
        console.log('📱 [BETTER AUTH] Mobile detected - redirecting to:', mobileRedirect);
        return mobileRedirect;
      }
      
      // For web requests, redirect to web app
      if (url.includes('localhost:3001') || url === '/') {
        const webRedirect = 'http://localhost:5173/dashboard';
        console.log('🌐 [BETTER AUTH] Web detected - redirecting to:', webRedirect);
        return webRedirect;
      }
      
      console.log('🔄 [BETTER AUTH] Using default redirect:', url);
      return url;
    }
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const { logger } = Sentry;
      
      // Log all incoming auth requests with detailed context
      logger.info('Better Auth request received', {
        path: ctx.path,
        method: ctx.request?.method,
        userAgent: ctx.request?.headers?.get('user-agent'),
        origin: ctx.request?.headers?.get('origin'),
        referer: ctx.request?.headers?.get('referer'),
        ip: ctx.request?.headers?.get('x-forwarded-for') || ctx.request?.headers?.get('x-real-ip'),
        timestamp: new Date().toISOString(),
        component: 'better-auth-before'
      });

      // Log social sign-in attempts
      if (ctx.path.includes('/sign-in/social/')) {
        const provider = ctx.path.split('/sign-in/social/')[1];
        logger.info('Social sign-in attempt', {
          provider,
          origin: ctx.request?.headers?.get('origin'),
          referer: ctx.request?.headers?.get('referer'),
          userAgent: ctx.request?.headers?.get('user-agent'),
          component: 'better-auth-social-signin'
        });
      }

      // Log OAuth callbacks
      if (ctx.path.includes('/callback/')) {
        const provider = ctx.path.split('/callback/')[1];
        logger.info('OAuth callback received', {
          provider,
          hasCode: ctx.request?.url?.includes('code='),
          hasError: ctx.request?.url?.includes('error='),
          component: 'better-auth-callback'
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Auto-verify users who sign up through invite links
      if (ctx.path.includes("/callback/") && ctx.context.newSession) {
        const { logger } = Sentry;
        const newSession = ctx.context.newSession;
        
        if (newSession && newSession.user) {
          // Check if this is an invite signup by looking for invite code in referrer or callback URL
          const referrer = ctx.request?.headers?.get('referer') || '';
          const inviteCode = referrer.includes('invite=') ? 
            referrer.split('invite=')[1]?.split('&')[0] : null;
          
          if (inviteCode) {
            try {
              // Validate and mark user as verified if they have a valid invite
              const [validInvite] = await authDb
                .select()
                .from(schema.inviteCodes)
                .where(
                  and(
                    eq(schema.inviteCodes.code, inviteCode),
                    eq(schema.inviteCodes.isActive, true)
                  )
                );

              if (validInvite && (!validInvite.expiresAt || validInvite.expiresAt > new Date())) {
                // Mark user as verified immediately
                await authDb
                  .update(schema.user)
                  .set({ isVerified: true })
                  .where(eq(schema.user.id, newSession.user.id));
                
                logger.info('Auto-verified user via invite signup', { 
                  userId: newSession.user.id,
                  email: newSession.user.email,
                  inviteCode,
                  component: 'auth-hook' 
                });
              }
            } catch (error) {
              logger.error('Error during auto-verification', { 
                userId: newSession.user.id,
                email: newSession.user.email,
                inviteCode,
                error: error instanceof Error ? error.message : 'Unknown error',
                component: 'auth-hook' 
              });
            }
          }
        }
      }
      
      // Log new user registrations to Sentry
      // Log new user registrations to Sentry
      if (ctx.path.startsWith("/sign-up") || ctx.path.includes("/callback/")) {
        const newSession = ctx.context.newSession;
        if (newSession && newSession.user) {
          const user = newSession.user;
          
          const provider = ctx.path.includes("/callback/") ? ctx.path.split("/callback/")[1] : "email";
          const { logger } = Sentry;
          
          // Set user context for Sentry
          Sentry.setUser({
            id: user.id,
            email: user.email,
            username: user.name
          });

          // Set tags for filtering
          Sentry.setTag("event_type", "user_registration");
          Sentry.setTag("auth_provider", provider);

          // Log the registration event using Sentry logger
          logger.info(logger.fmt`New user registered: ${user.email} via ${provider}`, {
            userId: user.id,
            email: user.email,
            name: user.name,
            provider: provider,
            registrationTime: new Date().toISOString(),
            userAgent: ctx.request?.headers?.get("user-agent") || "unknown",
            ip: ctx.request?.headers?.get("x-forwarded-for") || ctx.request?.headers?.get("x-real-ip") || "unknown"
          });

          console.log('🎉 New user registered and logged to Sentry:', { id: user.id, email: user.email, provider });
        }
      }

      // Log successful authentications
      if (ctx.context.newSession) {
        const { logger } = Sentry;
        const session = ctx.context.newSession;
        logger.info('Authentication successful', {
          userId: session.user?.id,
          email: session.user?.email,
          provider: ctx.path.includes('/callback/') ? ctx.path.split('/callback/')[1] : 'unknown',
          isNewUser: ctx.context.isNewUser,
          component: 'better-auth-success'
        });
      }
    }),
  },
} as any);

console.log('🔧 Better Auth initialized successfully');
console.log('🔧 Better Auth handlers available:', Object.keys(auth.api));