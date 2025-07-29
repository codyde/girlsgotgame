// Fix all broken manual player links
// Run with: npx tsx fix-all-manual-links.ts

import { db } from './src/db/index';
import { eq, and, isNull } from 'drizzle-orm';
import { user, manualPlayers, gamePlayers } from './src/db/schema';

async function fixAllManualPlayerLinks() {
  console.log('🔧 FIXING ALL MANUAL PLAYER LINKS\n');
  
  try {
    const adminUserId = 'codydearkland@gmail.com'; // Admin who's doing the linking
    
    // Get all manual players that aren't linked but have game data
    const unlinkedManualPlayers = await db
      .select()
      .from(manualPlayers)
      .where(isNull(manualPlayers.linkedUserId));
    
    console.log(`Found ${unlinkedManualPlayers.length} unlinked manual players`);
    
    let fixedCount = 0;
    
    for (const manualPlayer of unlinkedManualPlayers) {
      console.log(`\n🔍 Checking manual player: ${manualPlayer.name} (ID: ${manualPlayer.id})`);
      
      // Check if this manual player has game participation
      const gameParticipation = await db
        .select({ gameId: gamePlayers.gameId })
        .from(gamePlayers)
        .where(eq(gamePlayers.manualPlayerId, manualPlayer.id));
      
      if (gameParticipation.length === 0) {
        console.log(`   ⏭️  No game participation - skipping`);
        continue;
      }
      
      console.log(`   📊 Has ${gameParticipation.length} game(s) participation`);
      
      // Check if there's a user account with the same ID
      const matchingUser = await db
        .select()
        .from(user)
        .where(eq(user.id, manualPlayer.id))
        .limit(1);
      
      if (matchingUser.length === 0) {
        console.log(`   ❌ No matching user account found with ID ${manualPlayer.id}`);
        continue;
      }
      
      const userAccount = matchingUser[0];
      console.log(`   ✅ Found matching user: ${userAccount.name} (${userAccount.email})`);
      
      // Link the manual player to the user account
      const [updatedManualPlayer] = await db
        .update(manualPlayers)
        .set({
          linkedUserId: userAccount.id,
          linkedBy: adminUserId,
          linkedAt: new Date()
        })
        .where(eq(manualPlayers.id, manualPlayer.id))
        .returning();
      
      console.log(`   🔗 Successfully linked manual player to user account!`);
      fixedCount++;
    }
    
    console.log(`\n🎉 COMPLETED! Fixed ${fixedCount} manual player links`);
    
    // Verify the fixes
    console.log('\n📊 VERIFICATION:');
    const linkedPlayers = await db
      .select({
        id: manualPlayers.id,
        name: manualPlayers.name,
        linkedUserId: manualPlayers.linkedUserId,
        linkedAt: manualPlayers.linkedAt
      })
      .from(manualPlayers)
      .where(isNull(manualPlayers.linkedUserId));
    
    console.log(`Manual players still unlinked: ${linkedPlayers.length}`);
    if (linkedPlayers.length > 0) {
      linkedPlayers.forEach(player => {
        console.log(`  - ${player.name} (ID: ${player.id})`);
      });
    } else {
      console.log('✅ All manual players with game data are now properly linked!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing links:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixAllManualPlayerLinks();