// Check all manual players for linking issues
// Run with: npx tsx check-all-manual-links.ts

import { db } from './src/db/index';
import { eq, and, or, inArray } from 'drizzle-orm';
import { 
  user, 
  parentChildRelations, 
  manualPlayers, 
  gamePlayers, 
  gameStats 
} from './src/db/schema';

async function checkAllManualPlayerLinks() {
  console.log('🔍 CHECKING ALL MANUAL PLAYER LINKS\n');
  
  try {
    // 1. Get all manual players
    console.log('1️⃣ ALL MANUAL PLAYERS:');
    const allManualPlayers = await db
      .select()
      .from(manualPlayers);
    
    console.log(`Found ${allManualPlayers.length} manual players:`);
    allManualPlayers.forEach(player => {
      const linkStatus = player.linkedUserId ? '✅ LINKED' : '❌ NOT LINKED';
      console.log(`  - ${player.name} (ID: ${player.id}, Jersey #${player.jerseyNumber || 'N/A'}) - ${linkStatus}`);
      if (player.linkedUserId) {
        console.log(`    └─ Linked to user: ${player.linkedUserId}`);
      }
    });
    console.log('');

    // 2. Check for potential linking issues
    console.log('2️⃣ POTENTIAL LINKING ISSUES:');
    
    // Find manual players that participate in games but aren't linked
    const unlinkedWithGameData = [];
    
    for (const player of allManualPlayers) {
      if (!player.linkedUserId) {
        // Check if this manual player has game participation
        const gameParticipation = await db
          .select({
            gameId: gamePlayers.gameId,
            jerseyNumber: gamePlayers.jerseyNumber
          })
          .from(gamePlayers)
          .where(eq(gamePlayers.manualPlayerId, player.id));
        
        if (gameParticipation.length > 0) {
          // Check if there are stats for this player
          const stats = await db
            .select({ count: gamePlayers.id })
            .from(gameStats)
            .innerJoin(gamePlayers, eq(gameStats.gamePlayerId, gamePlayers.id))
            .where(eq(gamePlayers.manualPlayerId, player.id));
          
          console.log(`⚠️  ${player.name} (${player.id}):`);
          console.log(`    - Has ${gameParticipation.length} game(s) participation`);
          console.log(`    - Has ${stats.length} stat records`);
          console.log(`    - But is NOT linked to any user account`);
          
          // Check if there's a user account with similar details
          const similarUsers = await db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role
            })
            .from(user)
            .where(eq(user.role, 'player'));
          
          const possibleMatches = similarUsers.filter(u => 
            u.name?.toLowerCase().includes(player.name.toLowerCase()) ||
            player.name.toLowerCase().includes(u.name?.toLowerCase() || '')
          );
          
          if (possibleMatches.length > 0) {
            console.log(`    💡 Possible user matches:`);
            possibleMatches.forEach(match => {
              console.log(`      - ${match.name} (${match.email}) ID: ${match.id}`);
            });
          }
          
          unlinkedWithGameData.push({
            manualPlayer: player,
            gameParticipation,
            statsCount: stats.length,
            possibleMatches
          });
        }
      }
    }
    
    if (unlinkedWithGameData.length === 0) {
      console.log('✅ No manual players with game data are missing links!');
    }
    console.log('');

    // 3. Check all parent-child relationships for manual players
    console.log('3️⃣ PARENT-CHILD RELATIONSHIPS WITH MANUAL PLAYERS:');
    const relationships = await db
      .select()
      .from(parentChildRelations);
    
    for (const rel of relationships) {
      const child = await db.select().from(user).where(eq(user.id, rel.childId)).limit(1);
      const parent = await db.select().from(user).where(eq(user.id, rel.parentId)).limit(1);
      
      if (child[0]) {
        // Check if this child has games via linked manual players
        const linkedGames = await db
          .select({
            gameId: gamePlayers.gameId,
            manualPlayerName: manualPlayers.name
          })
          .from(gamePlayers)
          .innerJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
          .where(eq(manualPlayers.linkedUserId, rel.childId));
        
        // Check direct games
        const directGames = await db
          .select({ gameId: gamePlayers.gameId })
          .from(gamePlayers)
          .where(eq(gamePlayers.userId, rel.childId));
        
        console.log(`👨‍👩‍👧 ${parent[0]?.name} -> ${child[0].name}:`);
        console.log(`    - Direct games: ${directGames.length}`);
        console.log(`    - Via linked manual players: ${linkedGames.length}`);
        
        if (linkedGames.length > 0) {
          linkedGames.forEach(game => {
            console.log(`      └─ Game ${game.gameId} via "${game.manualPlayerName}"`);
          });
        }
      }
    }

    console.log('\n✅ MANUAL PLAYER LINK CHECK COMPLETE');
    
  } catch (error) {
    console.error('❌ Error during check:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkAllManualPlayerLinks();