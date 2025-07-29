// Debug unlinked manual players
// Run with: npx tsx debug-unlinked.ts

import { db } from './src/db/index';
import { eq, isNull } from 'drizzle-orm';
import { manualPlayers } from './src/db/schema';

async function debugUnlinked() {
  console.log('🔍 DEBUGGING UNLINKED MANUAL PLAYERS\n');
  
  try {
    // Get all manual players
    const allPlayers = await db
      .select()
      .from(manualPlayers);
    
    console.log('All manual players:');
    allPlayers.forEach(player => {
      console.log(`- ${player.name}: linkedUserId = ${player.linkedUserId}`);
    });
    
    console.log('\n--- Using isNull() ---');
    // Try with isNull
    const unlinkedWithIsNull = await db
      .select()
      .from(manualPlayers)
      .where(isNull(manualPlayers.linkedUserId));
    
    console.log(`Found ${unlinkedWithIsNull.length} unlinked (isNull):`, unlinkedWithIsNull.map(p => p.name));
    
    console.log('\n--- Using eq(null) ---');
    // Try with eq(null)
    const unlinkedWithEqNull = await db
      .select()
      .from(manualPlayers)
      .where(eq(manualPlayers.linkedUserId, null));
    
    console.log(`Found ${unlinkedWithEqNull.length} unlinked (eq null):`, unlinkedWithEqNull.map(p => p.name));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

debugUnlinked();