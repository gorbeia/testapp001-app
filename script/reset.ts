import pg from "pg";
import * as dotenv from "dotenv";
import { execSync } from "child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config();

/** Drops every table in `public` (no hardcoded list). */
const DROP_ALL_PUBLIC_TABLES = `
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 'public', r.tablename);
  END LOOP;
END $$;
`;

async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  console.log("Starting database reset using drizzle-kit push...");

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log("Dropping all tables in schema public...");
    await pool.query(DROP_ALL_PUBLIC_TABLES);
    console.log("All tables dropped successfully");

    console.log("Creating schema from shared/schema.ts using drizzle-kit push...");
    execSync("pnpm db:push", { stdio: "inherit", cwd: repoRoot });
    console.log("Schema created successfully");

    console.log("Ensuring migrations folder structure exists...");
    execSync("mkdir -p migrations", { stdio: "inherit", cwd: repoRoot });

    console.log("Database reset completed successfully!");
  } catch (error) {
    console.error("Database reset failed:", error);
    throw error;
  } finally {
    await pool.end();
    console.log("Database connection closed");
  }
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  resetDatabase()
    .then(() => {
      console.log("Database reset completed. You can now run the seeding scripts.");
      process.exit(0);
    })
    .catch(error => {
      console.error("Database reset failed:", error);
      process.exit(1);
    });
}

export { resetDatabase };
