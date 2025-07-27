const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config();

// Database connection using DATABASE_URL
const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/girlsgotgame');

async function runMigrations() {
  try {
    console.log('🚀 Running database migrations...');
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'src/db/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure correct order
    
    console.log(`Found ${files.length} migration files`);
    
    for (const file of files) {
      if (file.includes('media_uploads') || file.includes('media_id') || file.includes('reports') || file.includes('game_players')) {
        console.log(`📝 Running migration: ${file}`);
        
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        try {
          await sql.unsafe(migrationSQL);
          console.log(`✅ Successfully applied: ${file}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Skipping ${file} - already exists`);
          } else {
            console.error(`❌ Error applying ${file}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('🎉 All media-related migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();