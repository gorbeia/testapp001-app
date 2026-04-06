import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { credits, normalizeSocietyPaymentMethods, societies, type SocietyPaymentMethod } from "../shared/schema";
import { DEMO_SOCIETY_ALPHABETIC_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";

const BAZKIDEA_USER_ID = "550e8400-e29b-41d4-a716-446655440004";

/** Pending subscription month used by cash POS / Kutxa E2E (must match `repair-cash-pos-e2e-state`). */
export const CASH_POS_E2E_CREDIT_MONTH = "2026-04";

/**
 * Idempotent fixtures for cash POS / pending-payments E2E.
 * - Ensures demo society accepts manual cash
 * - Ensures one pending credit with subscription line for the demo bazkidea (April 2026 — aligns with test date)
 */
export async function seedCashPosFixtures(dbConn: SeedDb) {
  const [society] = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.alphabeticId, DEMO_SOCIETY_ALPHABETIC_ID))
    .limit(1);
  if (!society) {
    console.log("seedCashPosFixtures: demo society not found, skipping");
    return;
  }

  const paymentMethods = [...normalizeSocietyPaymentMethods(society.paymentMethods)];
  for (const m of ["cash_manual", "bank_transfer_prepayment"] as SocietyPaymentMethod[]) {
    if (!paymentMethods.includes(m)) paymentMethods.push(m);
  }
  await dbConn
    .update(societies)
    .set({
      paymentMethods,
      updatedAt: new Date(),
    })
    .where(eq(societies.id, society.id));

  const monthLabel = CASH_POS_E2E_CREDIT_MONTH;
  const existing = await dbConn
    .select({ id: credits.id })
    .from(credits)
    .where(
      and(
        eq(credits.societyId, society.id),
        eq(credits.memberId, BAZKIDEA_USER_ID),
        eq(credits.month, monthLabel)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log("seedCashPosFixtures: credit for bazkidea Apr 2026 already exists");
    return;
  }

  await dbConn.insert(credits).values({
    memberId: BAZKIDEA_USER_ID,
    societyId: society.id,
    month: monthLabel,
    year: 2026,
    monthNumber: 4,
    consumptionAmount: "0",
    reservationAmount: "0",
    subscriptionAmount: "15.00",
    totalAmount: "15.00",
    status: "pending",
  });
  console.log("seedCashPosFixtures: inserted pending subscription credit for bazkidea 2026-04");
}
