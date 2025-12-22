import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  console.log('Starting database reset using drizzle-kit push...');

  // Create database client
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // Drop all tables manually first (in dependency order)
    console.log('Dropping all tables...');
    
    const dropTables = `
      DROP TABLE IF EXISTS "notification_messages" CASCADE;
      DROP TABLE IF EXISTS "notifications" CASCADE;
      DROP TABLE IF EXISTS "note_messages" CASCADE;
      DROP TABLE IF EXISTS "notes" CASCADE;
      DROP TABLE IF EXISTS "credits" CASCADE;
      DROP TABLE IF EXISTS "reservations" CASCADE;
      DROP TABLE IF EXISTS "tables" CASCADE;
      DROP TABLE IF EXISTS "stock_movements" CASCADE;
      DROP TABLE IF EXISTS "consumption_items" CASCADE;
      DROP TABLE IF EXISTS "consumptions" CASCADE;
      DROP TABLE IF EXISTS "products" CASCADE;
      DROP TABLE IF EXISTS "category_messages" CASCADE;
      DROP TABLE IF EXISTS "product_categories" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;
      DROP TABLE IF EXISTS "subscription_types" CASCADE;
      DROP TABLE IF EXISTS "societies" CASCADE;
    `;

    await pool.query(dropTables);
    console.log('All tables dropped successfully');

    // Clear any remaining drizzle migration history
    console.log('Clearing any remaining migration history...');
    await pool.query(`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`);

    // Use drizzle-kit push to create schema from shared/schema.ts
    console.log('Creating schema from shared/schema.ts using drizzle-kit push...');
    execSync('pnpm db:push', { stdio: 'inherit' });
    console.log('Schema created successfully');

    // Create empty migrations folder structure for future use
    console.log('Ensuring migrations folder structure exists...');
    execSync('mkdir -p migrations', { stdio: 'inherit' });

    console.log('Database reset completed successfully!');
    
  } catch (error) {
    console.error('Database reset failed:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the reset if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then(() => {
      console.log('Database reset completed. You can now run the seeding scripts.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database reset failed:', error);
      process.exit(1);
    });
}

export { resetDatabase };
