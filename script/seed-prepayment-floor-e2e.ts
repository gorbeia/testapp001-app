import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { accountMovements, societies } from "../shared/schema";
import { db, pool } from "../server/db";
import { DEMO_SOCIETY_ALPHABETIC_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";

const BAZKIDEA_USER_ID = "550e8400-e29b-41d4-a716-446655440004";

/** Ledger rows tagged for idempotent E2E prepayment-floor balance normalization. */
export const E2E_PREPAYMENT_FLOOR_REF_TYPE = "e2e_prepayment_floor";

const TARGET_LEDGER_BALANCE = -60;
const PREPAYMENT_FLOOR = "-50";

/**
 * Idempotent fixtures for prepayment ledger floor E2E:
 * - Sets demo society `prepaymentMinLedgerBalance` to -50 (max ~50€ debt).
 * - Normalizes demo bazkidea ledger sum to -60 (strictly below floor) via one tagged adjustment.
 */
export async function seedPrepaymentFloorE2EFixtures(dbConn: SeedDb) {
  const [society] = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.alphabeticId, DEMO_SOCIETY_ALPHABETIC_ID))
    .limit(1);
  if (!society) {
    console.log("seedPrepaymentFloorE2EFixtures: demo society not found, skipping");
    return;
  }

  await dbConn
    .update(societies)
    .set({
      prepaymentMinLedgerBalance: PREPAYMENT_FLOOR,
      updatedAt: new Date(),
    })
    .where(eq(societies.id, society.id));

  await dbConn
    .delete(accountMovements)
    .where(
      and(
        eq(accountMovements.userId, BAZKIDEA_USER_ID),
        eq(accountMovements.referenceType, E2E_PREPAYMENT_FLOOR_REF_TYPE)
      )
    );

  const [sumRow] = await dbConn
    .select({
      total: sql<string>`coalesce(sum(${accountMovements.amount}::numeric), 0)`,
    })
    .from(accountMovements)
    .where(
      and(eq(accountMovements.societyId, society.id), eq(accountMovements.userId, BAZKIDEA_USER_ID))
    );

  const current = parseFloat(sumRow?.total ?? "0");
  const delta = TARGET_LEDGER_BALANCE - current;
  if (Math.abs(delta) < 1e-6) {
    console.log(
      "seedPrepaymentFloorE2EFixtures: bazkidea already at target balance, no adjustment"
    );
    return;
  }

  await dbConn.insert(accountMovements).values({
    societyId: society.id,
    userId: BAZKIDEA_USER_ID,
    type: "adjustment",
    amount: delta.toFixed(2),
    description: "E2E prepayment ledger floor fixture",
    referenceId: "fixture",
    referenceType: E2E_PREPAYMENT_FLOOR_REF_TYPE,
  });

  console.log(
    `seedPrepaymentFloorE2EFixtures: floor ${PREPAYMENT_FLOOR}€, bazkidea balance normalized toward ${TARGET_LEDGER_BALANCE} (delta ${delta.toFixed(2)})`
  );
}

/** Remove tagged ledger rows and clear society floor so other E2E features keep a neutral demo DB. */
export async function undoPrepaymentFloorE2EFixtures(dbConn: SeedDb = db): Promise<void> {
  const [society] = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.alphabeticId, DEMO_SOCIETY_ALPHABETIC_ID))
    .limit(1);
  if (!society) {
    console.log("undoPrepaymentFloorE2EFixtures: demo society not found, skipping");
    return;
  }

  await dbConn
    .delete(accountMovements)
    .where(
      and(
        eq(accountMovements.userId, BAZKIDEA_USER_ID),
        eq(accountMovements.referenceType, E2E_PREPAYMENT_FLOOR_REF_TYPE)
      )
    );

  await dbConn
    .update(societies)
    .set({
      prepaymentMinLedgerBalance: null,
      updatedAt: new Date(),
    })
    .where(eq(societies.id, society.id));

  console.log(
    "undoPrepaymentFloorE2EFixtures: fixture movements removed, prepayment floor cleared"
  );
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const run = process.argv.includes("--undo")
    ? undoPrepaymentFloorE2EFixtures(db)
    : seedPrepaymentFloorE2EFixtures(db);
  run
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() =>
      pool.end().then(() => {
        process.exit(process.exitCode ?? 0);
      })
    );
}
