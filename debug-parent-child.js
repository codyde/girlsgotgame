#!/usr/bin/env node

// Debug script to check parent-child relationships and manual player linking
// Run with: node debug-parent-child.js

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, or } = require('drizzle-orm');
const { 
  user, 
  parentChildRelations, 
  manualPlayers, 
  gamePlayers, 
  gameStats,
  games 
} = require('./server/src/db/schema.js');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/girlsgotgame';
const sql = postgres(connectionString);
const db = drizzle(sql);

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
      .select({
        id: parentChildRelations.id,
        parentId: parentChildRelations.parentId,
        childId: parentChildRelations.childId,
        createdAt: parentChildRelations.createdAt,
        parentName: user.name,
        parentEmail: user.email
      })
      .from(parentChildRelations)
      .leftJoin(user, eq(parentChildRelations.parentId, user.id));
    
    console.log(`Found ${relationships.length} parent-child relationships:`);
    relationships.forEach(rel => {
      console.log(`  - Parent: ${rel.parentName || 'No name'} (${rel.parentEmail}) -> Child ID: ${rel.childId}`);
    });
    console.log('');

    // 3. Get child user details
    console.log('3️⃣ CHILD USER DETAILS:');
    const childIds = relationships.map(rel => rel.childId);
    if (childIds.length > 0) {
      const children = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          totalPoints: user.totalPoints
        })
        .from(user)
        .where((user, { inArray }) => inArray(user.id, childIds));
      
      console.log(`Found ${children.length} child users:`);
      children.forEach(child => {
        console.log(`  - ${child.name || 'No name'} (${child.email}) ID: ${child.id} - ${child.totalPoints} points`);
      });
    } else {
      console.log('No child users found');
    }
    console.log('');

    // 4. Get all manual players
    console.log('4️⃣ MANUAL PLAYERS:');
    const allManualPlayers = await db
      .select({
        id: manualPlayers.id,
        name: manualPlayers.name,
        jerseyNumber: manualPlayers.jerseyNumber,
        linkedUserId: manualPlayers.linkedUserId,
        linkedBy: manualPlayers.linkedBy,
        linkedAt: manualPlayers.linkedAt
      })
      .from(manualPlayers);
    
    console.log(`Found ${allManualPlayers.length} manual players:`);
    allManualPlayers.forEach(player => {
      const linkStatus = player.linkedUserId ? `LINKED to user ${player.linkedUserId}` : 'NOT LINKED';
      console.log(`  - ${player.name} (Jersey #${player.jerseyNumber || 'N/A'}) - ${linkStatus}`);
    });
    console.log('');

    // 5. Check game players table
    console.log('5️⃣ GAME PLAYERS TABLE:');
    const allGamePlayers = await db
      .select({
        id: gamePlayers.id,
        gameId: gamePlayers.gameId,
        userId: gamePlayers.userId,
        manualPlayerId: gamePlayers.manualPlayerId,
        jerseyNumber: gamePlayers.jerseyNumber,
        isStarter: gamePlayers.isStarter
      })
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

    // 6. For each child, check their game participation
    if (childIds.length > 0) {
      console.log('6️⃣ CHILD GAME PARTICIPATION:');
      for (const childId of childIds) {
        const child = children?.find(c => c.id === childId);
        console.log(`\n👶 Checking games for child: ${child?.name || 'Unknown'} (${childId})`);
        
        // Direct participation
        const directGames = await db
          .select({
            gameId: gamePlayers.gameId,
            jerseyNumber: gamePlayers.jerseyNumber,
            isStarter: gamePlayers.isStarter
          })
          .from(gamePlayers)
          .where(eq(gamePlayers.userId, childId));
        
        console.log(`  📝 Direct game participation: ${directGames.length} games`);
        directGames.forEach(game => {
          console.log(`    - Game ${game.gameId} (Jersey #${game.jerseyNumber || 'N/A'})`);
        });
        
        // Via linked manual players
        const linkedGames = await db
          .select({
            gameId: gamePlayers.gameId,
            manualPlayerId: gamePlayers.manualPlayerId,
            manualPlayerName: manualPlayers.name,
            jerseyNumber: gamePlayers.jerseyNumber
          })
          .from(gamePlayers)
          .leftJoin(manualPlayers, eq(gamePlayers.manualPlayerId, manualPlayers.id))
          .where(eq(manualPlayers.linkedUserId, childId));
        
        console.log(`  🔗 Via linked manual players: ${linkedGames.length} games`);
        linkedGames.forEach(game => {
          console.log(`    - Game ${game.gameId} via manual player "${game.manualPlayerName}" (Jersey #${game.jerseyNumber || 'N/A'})`);
        });
        
        // Check game stats
        const allGamePlayerIds = [
          ...directGames.map(g => g.gameId),
          ...linkedGames.map(g => g.gameId)
        ];
        
        if (allGamePlayerIds.length > 0) {
          const stats = await db
            .select({
              gameId: gameStats.gameId,
              gamePlayerId: gameStats.gamePlayerId,
              statType: gameStats.statType,
              value: gameStats.value
            })
            .from(gameStats)
            .leftJoin(gamePlayers, eq(gameStats.gamePlayerId, gamePlayers.id))
            .where(
              or(
                eq(gamePlayers.userId, childId),
                and(
                  eq(gamePlayers.manualPlayerId, manualPlayers.id),
                  eq(manualPlayers.linkedUserId, childId)
                )
              )
            );
          
          console.log(`  📊 Total stats recorded: ${stats.length}`);
        }
      }
    }

    console.log('\n✅ DEBUG COMPLETE');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await sql.end();
  }
}

// Run the debug script
debugParentChildRelationships();