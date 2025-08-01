import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as Sentry from "@sentry/node";
import { eq } from 'drizzle-orm';
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
      maxAge: 5 * 60  // 5 minutes - Better Auth best practice
    }
  },
  
  trustedOrigins: process.env.NODE_ENV === 'production'
    ? ["https://girlsgotgame.app"]
    : ["http://localhost:5173"]
});

