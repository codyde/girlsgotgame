const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq } = require('drizzle-orm');
const { emailWhitelist, user } = require('./dist/db/schema');
require('dotenv').config();

async function bootstrap() {
  try {
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    const db = drizzle(client, { schema: require('./dist/db/schema') });

    // Add your email to whitelist
    const email = 'codydearkland@gmail.com';
    
    console.log('Adding email to whitelist:', email);
    
    // Check if already exists
    const existing = await db
      .select()
      .from(emailWhitelist)
      .where(eq(emailWhitelist.email, email));
      
    if (existing.length > 0) {
      console.log('Email already in whitelist');
    } else {
      await db.insert(emailWhitelist).values({
        email: email,
        addedBy: 'bootstrap', // Temporary ID
      });
      console.log('Email added to whitelist successfully');
    }

    // Update user role to admin
    console.log('Updating user role to admin for:', email);
    const updateResult = await db
      .update(user)
      .set({ role: 'admin' })
      .where(eq(user.email, email));
    
    console.log('User role updated to admin');
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

bootstrap();