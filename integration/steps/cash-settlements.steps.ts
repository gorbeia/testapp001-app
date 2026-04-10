import { Given } from "@cucumber/cucumber";
import { eq } from "drizzle-orm";

import { db } from "../../server/db";
import { DEMO_SOCIETY_ID } from "../../script/seed-demo-society";
import {
  normalizeSocietyPaymentMethods,
  societies,
  type SocietyPaymentMethod,
} from "@shared/schema";

/**
 * Ensures demo society accepts cash settlement (idempotent).
 * Local DBs may predate `cash_manual` in seed data; CI fresh seed usually already has it.
 */
Given("cash settlement is enabled for the demo society", async function () {
  const [row] = await db.select().from(societies).where(eq(societies.id, DEMO_SOCIETY_ID)).limit(1);
  if (!row) {
    return;
  }
  const methods = Array.from(
    new Set<SocietyPaymentMethod>([
      ...normalizeSocietyPaymentMethods(row.paymentMethods),
      "bank_transfer_prepayment",
      "cash_manual",
    ])
  );
  await db
    .update(societies)
    .set({ paymentMethods: methods, updatedAt: new Date() })
    .where(eq(societies.id, DEMO_SOCIETY_ID));
});
