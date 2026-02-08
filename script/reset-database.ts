import "dotenv/config";
import { execSync } from "child_process";
import { Client } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  console.log("Dropping all tables...");

  // Drop all tables in the correct order to avoid foreign key constraints
  const tables = [
    "notification_messages",
    "notifications",
    "consumption_items",
    "consumptions",
    "credits",
    "note_messages",
    "notes",
    "stock_movements",
    "reservations",
    "tables",
    "products",
    "users",
    "societies",
  ];

  for (const table of tables) {
    try {
      await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      console.log(`Dropped table: ${table}`);
    } catch (error) {
      console.log(`Table ${table} does not exist or could not be dropped`);
    }
  }

  console.log("All tables dropped successfully.");
  await client.end();
}

async function applySchema() {
  console.log("Applying schema using Drizzle push...");

  try {
    // Apply schema directly using drizzle-kit push
    console.log("Applying schema with drizzle-kit push...");
    execSync("drizzle-kit push", {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });

    console.log("Schema applied successfully using Drizzle push.");
  } catch (error) {
    console.error("Error applying schema with Drizzle:", error);
    throw error;
  }
}

async function main() {
  try {
    // Log the database user from DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }

    // Parse database user from URL
    let dbUser = "unknown";
    try {
      const url = new URL(databaseUrl);
      dbUser = url.username || "unknown";
    } catch (error) {
      console.warn("Could not parse DATABASE_URL, showing unknown user");
    }

    console.log(`Database reset and migration started by database user: ${dbUser}`);

    await resetDatabase();
    await applySchema();
    console.log("Database reset and migration completed successfully!");
  } catch (error) {
    console.error("Error during database reset:", error);
    process.exit(1);
  }
}

main();
