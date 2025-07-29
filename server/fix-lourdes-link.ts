// Fix script to properly link Lourdes Kooch manual player to her user account
// Run with: npx tsx fix-lourdes-link.ts

import { db } from './src/db/index';
import { eq } from 'drizzle-orm';
import { manualPlayers } from './src/db/schema';

async function fixLourdesLink() {
  console.log('🔧 FIXING LOURDES KOOCH MANUAL PLAYER LINK\n');
  
  try {
    const userId = 'da35eae1-a9b0-490d-910d-20ace0b738a5';
    const adminUserId = 'codydearkland@gmail.com'; // You as admin
    
    console.log(`Looking for manual player with name "Lourdes Kooch"...`);
    
    // Find the Lourdes Kooch manual player record
    const lourdesManualPlayers = await db
      .select()
      .from(manualPlayers)
      .where(eq(manualPlayers.name, 'Lourdes Kooch'));
    
    console.log(`Found ${lourdesManualPlayers.length} manual players named "Lourdes Kooch"`);
    
    if (lourdesManualPlayers.length === 0) {
      console.log('❌ No manual player found with name "Lourdes Kooch"');
      return;
    }
    
    // Update the manual player to link to the user
    for (const player of lourdesManualPlayers) {
      console.log(`Linking manual player ${player.id} to user ${userId}...`);
      
      const [updatedPlayer] = await db
        .update(manualPlayers)
        .set({
          linkedUserId: userId,
          linkedBy: adminUserId,
          linkedAt: new Date()
        })
        .where(eq(manualPlayers.id, player.id))
        .returning();
      
      console.log('✅ Successfully linked manual player:', {
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        linkedUserId: updatedPlayer.linkedUserId,
        linkedAt: updatedPlayer.linkedAt
      });
    }
    
    console.log('\n🎉 LINK FIXED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ Error fixing link:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixLourdesLink();