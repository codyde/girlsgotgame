import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

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
      ? ["https://girlsgotgame.app"]
      : ["http://localhost:5173", "http://localhost:5174"],
});

console.log('🔧 Better Auth initialized successfully');
console.log('🔧 Better Auth handlers available:', Object.keys(auth.api));