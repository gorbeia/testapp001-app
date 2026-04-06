import "dotenv/config";
import { and, eq, or } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import {
  accountMovements,
  ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
  ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
  credits,
  reservations,
  societies,
  tables,
} from "../shared/schema";
import { db, pool } from "../server/db";
import { CASH_POS_E2E_CREDIT_MONTH } from "./seed-cash-pos-fixtures";
import { DEMO_SOCIETY_ALPHABETIC_ID, DEMO_SOCIETY_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";

const BAZKIDEA_ID = "550e8400-e29b-41d4-a716-446655440004";
export const CASH_POS_E2E_RESERVATION_ID = "b2c3d4e5-f6a7-4890-bcde-f10000000001";

const SUB_REF = `${BAZKIDEA_ID}:${CASH_POS_E2E_CREDIT_MONTH}`;

/**
 * Reset DB state so the Kutxa “Ordaindu gabekoak” E2E / manual checks see the demo reservation
 * and subscription line again. Idempotent.
 *
 * After a successful E2E run (or manual checkout), `cash_payment` rows with refs
 * `reservation_cash` / `subscription_cash` hide those items from GET /api/me/pending-cash-items.
 * This removes those ledger rows and repairs the fixture reservation + credit row.
 */
export async function repairCashPosE2eState(dbConn: SeedDb = db): Promise<void> {
  const byId = await dbConn
    .select({ id: societies.id })
    .from(societies)
    .where(eq(societies.id, DEMO_SOCIETY_ID))
    .limit(1);
  const byAlpha =
    byId.length > 0
      ? byId
      : await dbConn
          .select({ id: societies.id })
          .from(societies)
          .where(eq(societies.alphabeticId, DEMO_SOCIETY_ALPHABETIC_ID))
          .limit(1);
  if (byAlpha.length === 0) {
    console.error("repairCashPosE2eState: demo society (GT001) not found");
    return;
  }
  const societyId = byAlpha[0].id;

  await dbConn.delete(accountMovements).where(
    and(
      eq(accountMovements.societyId, societyId),
      or(
        and(
          eq(accountMovements.referenceType, ACCOUNT_MOVEMENT_REF_RESERVATION_CASH),
          eq(accountMovements.referenceId, CASH_POS_E2E_RESERVATION_ID)
        ),
        and(
          eq(accountMovements.referenceType, ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH),
          eq(accountMovements.referenceId, SUB_REF)
        )
      )
    )
  );

  const cashE2eTables = await dbConn
    .select()
    .from(tables)
    .where(and(eq(tables.societyId, societyId), eq(tables.isActive, true)));
  const assignedTable =
    cashE2eTables.find(t => t.name === "Mahaia 1")?.name ?? cashE2eTables[0]?.name ?? "Mahaia 1";

  const [demoSociety] = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  const rp = parseFloat(demoSociety?.reservationPricePerMember ?? "2");
  const guests = 4;
  const totalAmountStr = (guests * rp).toString();

  const now = new Date();
  const [existingRes] = await dbConn
    .select()
    .from(reservations)
    .where(eq(reservations.id, CASH_POS_E2E_RESERVATION_ID))
    .limit(1);

  const reservationPayload = {
    userId: BAZKIDEA_ID,
    societyId,
    name: "Kutxa Erreserba E2E",
    type: "bazkaria" as const,
    status: "confirmed" as const,
    startDate: new Date("2026-06-15T19:00:00Z"),
    guests,
    useKitchen: false,
    table: assignedTable,
    notes: "Seed: bazkidea unpaid for cash POS E2E",
    totalAmount: totalAmountStr,
    cancellationReason: null as string | null,
    cancelledBy: null as string | null,
    cancelledAt: null as Date | null,
    updatedAt: now,
  };

  if (existingRes) {
    await dbConn
      .update(reservations)
      .set(reservationPayload)
      .where(eq(reservations.id, CASH_POS_E2E_RESERVATION_ID));
  } else {
    await dbConn.insert(reservations).values({
      ...reservationPayload,
      id: CASH_POS_E2E_RESERVATION_ID,
      createdAt: now,
    });
  }

  const [existingCredit] = await dbConn
    .select({ id: credits.id })
    .from(credits)
    .where(
      and(
        eq(credits.societyId, societyId),
        eq(credits.memberId, BAZKIDEA_ID),
        eq(credits.month, CASH_POS_E2E_CREDIT_MONTH)
      )
    )
    .limit(1);

  if (existingCredit) {
    await dbConn
      .update(credits)
      .set({
        subscriptionAmount: "15.00",
        totalAmount: "15.00",
        consumptionAmount: "0",
        reservationAmount: "0",
        status: "pending",
        paidAmount: "0",
        markedAsPaidBy: null,
        markedAsPaidAt: null,
        updatedAt: now,
      })
      .where(eq(credits.id, existingCredit.id));
  } else {
    await dbConn.insert(credits).values({
      memberId: BAZKIDEA_ID,
      societyId,
      month: CASH_POS_E2E_CREDIT_MONTH,
      year: 2026,
      monthNumber: 4,
      consumptionAmount: "0",
      reservationAmount: "0",
      subscriptionAmount: "15.00",
      totalAmount: "15.00",
      status: "pending",
    });
  }

  console.log("repairCashPosE2eState: cash POS E2E ledger + fixtures repaired");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  repairCashPosE2eState()
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
