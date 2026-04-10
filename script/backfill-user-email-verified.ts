import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";

/**
 * After adding `users.email_verified_at`, existing accounts remain NULL and cannot log in.
 * Run once per environment: `pnpm tsx script/backfill-user-email-verified.ts`
 */
async function main() {
  await db.execute(sql`
    UPDATE users
    SET email_verified_at = COALESCE(email_verified_at, created_at)
    WHERE email_verified_at IS NULL
  `);
  console.log("Backfill: set email_verified_at from created_at where it was null.");
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
