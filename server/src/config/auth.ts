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
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001/api/auth",
  secret: process.env.BETTER_AUTH_SECRET as string,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    }
  },
  cookies: {
    sameSite: "lax", // Important for OAuth flows
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
  },
  trustedOrigins: process.env.NODE_ENV === 'production'
      ? ["https://girlsgotgame.app", "myapp://"]
      : ["http://localhost:5173", "http://localhost:5174", "myapp://", "exp://192.168.1.8:8081/--"],
  hooks: {
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
    }),
  },
});

console.log('🔧 Better Auth initialized successfully');
console.log('🔧 Better Auth handlers available:', Object.keys(auth.api));