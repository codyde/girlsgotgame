#!/usr/bin/env node

/**
 * Script to drop all rows from all tables in the database
 * This will preserve table structure but remove all data
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  user, 
  session, 
  account, 
  verification, 
  workouts, 
  posts, 
  likes, 
  comments 
} from './src/db/schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function clearAllTables() {
  try {
    console.log('🗑️  Starting to clear all tables...');
    
    // Clear tables in order to respect foreign key constraints
    // Start with tables that reference others, then work backwards
    
    console.log('Clearing comments...');
    await db.delete(comments);
    
    console.log('Clearing likes...');
    await db.delete(likes);
    
    console.log('Clearing posts...');
    await db.delete(posts);
    
    console.log('Clearing workouts...');
    await db.delete(workouts);
    
    console.log('Clearing sessions...');
    await db.delete(session);
    
    console.log('Clearing accounts...');
    await db.delete(account);
    
    console.log('Clearing verification...');
    await db.delete(verification);
    
    console.log('Clearing users...');
    await db.delete(user);
    
    console.log('✅ All tables cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing tables:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
clearAllTables();