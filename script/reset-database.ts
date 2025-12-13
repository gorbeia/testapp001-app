import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  
  console.log('Dropping all tables...');
  
  // Drop all tables in the correct order to avoid foreign key constraints
  const tables = [
    'chat_messages',
    'chat_rooms', 
    'consumption_items',
    'consumptions',
    'credits',
    'oharrak',
    'stock_movements',
    'reservations',
    'tables',
    'products',
    'users',
    'societies'
  ];
  
  for (const table of tables) {
    try {
      await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      console.log(`Dropped table: ${table}`);
    } catch (error) {
      console.log(`Table ${table} does not exist or could not be dropped`);
    }
  }
  
  console.log('All tables dropped successfully.');
  await client.end();
}

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  
  console.log('Applying consolidated migration...');
  
  // Read and execute the migration file
  const migrationPath = path.join(__dirname, '../migrations/0000_initial_schema.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split the SQL into individual statements and execute them
  const statements = migrationSQL.split('--> statement-breakpoint');
  let hasError = false;
  
  for (const statement of statements) {
    const trimmedStatement = statement.trim();
    if (trimmedStatement) {
      try {
        await client.query(trimmedStatement);
      } catch (error) {
        hasError = true;
        console.error('Error executing statement:', error);
        console.log('Statement was:', trimmedStatement.substring(0, 100) + '...');
        // Don't continue processing after an error
        break;
      }
    }
  }
  
  if (hasError) {
    console.error('Migration failed!');
    await client.end();
    throw new Error('Migration failed during execution');
  }
  
  console.log('Migration applied successfully.');
  await client.end();
}

async function main() {
  try {
    // Log the database user from DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    
    // Parse database user from URL
    let dbUser = 'unknown';
    try {
      const url = new URL(databaseUrl);
      dbUser = url.username || 'unknown';
    } catch (error) {
      console.warn('Could not parse DATABASE_URL, showing unknown user');
    }
    
    console.log(`Database reset and migration started by database user: ${dbUser}`);
    
    await resetDatabase();
    await applyMigration();
    console.log('Database reset and migration completed successfully!');
  } catch (error) {
    console.error('Error during database reset:', error);
    process.exit(1);
  }
}

main();
