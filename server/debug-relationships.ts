// Debug script to check parent-child relationships and manual player linking
// Run with: npx tsx debug-relationships.ts

import { db } from './src/db/index';
import { eq, and, or, inArray } from 'drizzle-orm';
import { 
  user, 
  parentChildRelations, 
  manualPlayers, 
  gamePlayers, 
  gameStats,
  games 
} from './src/db/schema';

async function debugParentChildRelationships() {
  console.log('🔍 DEBUGGING PARENT-CHILD RELATIONSHIPS AND MANUAL PLAYERS\n');
  
  try {
    // 1. Get all parent users
    console.log('1️⃣ PARENT USERS:');
    const parents = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      })
      .from(user)
      .where(eq(user.role, 'parent'));
    
    console.log(`Found ${parents.length} parent users:`);
    parents.forEach(parent => {
      console.log(`  - ${parent.name || 'No name'} (${parent.email}) ID: ${parent.id}`);
    });
    console.log('');

    // 2. Get all parent-child relationships
    console.log('2️⃣ PARENT-CHILD RELATIONSHIPS:');
    const relationships = await db
      .select()
      .from(parentChildRelations);
    
    console.log(`Found ${relationships.length} parent-child relationships:`);
    for (const rel of relationships) {
      const parent = await db.select().from(user).where(eq(user.id, rel.parentId)).limit(1);
      const child = await db.select().from(user).where(eq(user.id, rel.childId)).limit(1);
      console.log(`  - Parent: ${parent[0]?.name || 'No name'} (${parent[0]?.email}) -> Child: ${child[0]?.name || 'No name'} (${child[0]?.email}) ID: ${rel.childId}`);
    }
    console.log('');

    // 3. Get all manual players
    console.log('3️⃣ MANUAL PLAYERS:');
    const allManualPlayers = await db
      .select()
      .from(manualPlayers);
    
    console.log(`Found ${allManualPlayers.length} manual players:`);
    allManualPlayers.forEach(player => {
      const linkStatus = player.linkedUserId ? `LINKED to user ${player.linkedUserId}` : 'NOT LINKED';
      console.log(`  - ${player.name} (Jersey #${player.jerseyNumber || 'N/A'}) - ${linkStatus}`);
      if (player.linkedUserId) {
        console.log(`    └─ Linked at: ${player.linkedAt}, by: ${player.linkedBy}`);
      }
    });
    console.log('');

    // 4. Check game players table
    console.log('4️⃣ GAME PLAYERS TABLE:');
    const allGamePlayers = await db
      .select()
      .from(gamePlayers);
    
    console.log(`Found ${allGamePlayers.length} game player records:`);
    allGamePlayers.forEach(gp => {
      if (gp.userId) {
        console.log(`  - Game ${gp.gameId}: User ${gp.userId} (Jersey #${gp.jerseyNumber || 'N/A'})`);
      } else if (gp.manualPlayerId) {
        console.log(`  - Game ${gp.gameId}: Manual Player ${gp.manualPlayerId} (Jersey #${gp.jerseyNumber || 'N/A'})`);
      }
    });
    console.log('');

    // 5. For each child, check their game participation
    if (relationships.length > 0) {
      console.log('5️⃣ CHILD GAME PARTICIPATION:');
      for (const rel of relationships) {
        const child = await db.select().from(user).where(eq(user.id, rel.childId)).limit(1);
        console.log(`\n👶 Checking games for child: ${child[0]?.name || 'Unknown'} (${rel.childId})`);
        
        // Direct participation
        const directGames = await db
          .select({
            id: gamePlayers.id,
            gameId: gamePlayers.gameId,
            jerseyNumber: gamePlayers.jerseyNumber,
            isStarter: gamePlayers.isStarter
          })
          .from(gamePlayers)
          .where(eq(gamePlayers.userId, rel.childId));
        
        console.log(`  📝 Direct game participation: ${directGames.length} games`);
        directGames.forEach(game => {
          console.log(`    - Game ${game.gameId} (GamePlayer ID: ${game.id}, Jersey #${game.jerseyNumber || 'N/A'})`);
        });
        
        // Via linked manual players
        const linkedGames = await db
          .select({
            gamePlayerId: gamePlayers.id,
            gameId: gamePlayers.gameId,
            manualPlayerId: gamePlayers.manualPlayerId,
            jerseyNumber: gamePlayers.jerseyNumber
          })
          .from(gamePlayers)
          .innerJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
          .where(eq(manualPlayers.linkedUserId, rel.childId));
        
        console.log(`  🔗 Via linked manual players: ${linkedGames.length} games`);
        linkedGames.forEach(game => {
          console.log(`    - Game ${game.gameId} (GamePlayer ID: ${game.gamePlayerId}, Jersey #${game.jerseyNumber || 'N/A'})`);
        });
        
        // Check game stats for this child
        const allGamePlayerIds = [
          ...directGames.map(g => g.id),
          ...linkedGames.map(g => g.gamePlayerId)
        ];
        
        if (allGamePlayerIds.length > 0) {
          const stats = await db
            .select({
              id: gameStats.id,
              gameId: gameStats.gameId,
              gamePlayerId: gameStats.gamePlayerId,
              statType: gameStats.statType,
              value: gameStats.value
            })
            .from(gameStats)
            .where(inArray(gameStats.gamePlayerId, allGamePlayerIds));
          
          console.log(`  📊 Total stats recorded: ${stats.length}`);
          stats.forEach(stat => {
            console.log(`    - Game ${stat.gameId}: ${stat.statType} (value: ${stat.value}) - GamePlayer: ${stat.gamePlayerId}`);
          });
        } else {
          console.log(`  📊 No game participation found, so no stats to check`);
        }
      }
    }

    console.log('\n✅ DEBUG COMPLETE');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    process.exit(0);
  }
}

// Run the debug script
debugParentChildRelationships();