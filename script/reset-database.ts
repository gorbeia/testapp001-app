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
    'notifications',
    'consumption_items',
    'consumptions',
    'credits',
    'note_messages',
    'notes',
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
  
  // Apply all migrations in order
  const migrationFiles = [
    '0002_remove_chat_tables.sql',  // Remove chat tables first
    '0000_initial_schema.sql',     // Then create main schema (includes oharrak table)
    '0003_create_notifications.sql',
    '0004_add_notification_messages.sql',
    '0003_aspiring_glorian.sql',   // Rename oharrak to notes and setup constraints
    '0002_nosy_kang.sql',          // Create note_messages and migrate data
    '0005_migrate_notes_multilanguage.sql', // Create multilanguage structure
    '0006_remove_note_columns.sql', // Clean up old columns
    '0007_add_notify_users_to_notes.sql', // Add notify_users column
    '0008_add_notification_type_fields.sql' // Add notification type fields
  ];
  
  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(__dirname, '../migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`Migration file ${migrationFile} not found, skipping...`);
      continue;
    }
    
    console.log(`Applying migration: ${migrationFile}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL.split('--> statement-breakpoint');
    
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        try {
          await client.query(trimmedStatement);
        } catch (error) {
          console.error('Error executing statement:', error);
          console.log('Statement was:', trimmedStatement.substring(0, 100) + '...');
          // Don't continue processing after an error
          throw new Error(`Migration failed during execution of ${migrationFile}`);
        }
      }
    }
    
    console.log(`Migration ${migrationFile} applied successfully.`);
  }
  
  console.log('All migrations applied successfully.');
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
