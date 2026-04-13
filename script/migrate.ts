/**
 * Unattended production migrator.
 * Applies all pending SQL files from migrations/ using the Drizzle
 * programmatic API — no CLI prompts, safe to run in deployment pipelines.
 *
 * Usage:
 *   pnpm db:migrate            # apply pending migrations
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../server/db";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = path.join(repoRoot, "migrations");

async function runMigrations() {
  console.log("Running migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
}

runMigrations()
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
