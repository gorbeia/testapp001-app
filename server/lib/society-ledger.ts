import { and, eq, sql, inArray } from "drizzle-orm";
import { db, type AppDatabase } from "../db";
import { societyLedger, type SocietyLedgerType } from "@shared/schema";
import { formatLedgerAmount, LedgerAmountError } from "./ledger/ledger-rules";

export const SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT = "account_movement";
export const SOCIETY_LEDGER_REF_MANUAL_ENTRY = "manual_entry";

const MANUAL_PRIMARY = ["manual_income", "manual_expense"] as const;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function societyLedgerEntryExists(
  societyId: string,
  referenceType: string,
  referenceId: string,
  executor: AppDatabase = db
): Promise<boolean> {
  const [row] = await executor
    .select({ id: societyLedger.id })
    .from(societyLedger)
    .where(
      and(
        eq(societyLedger.societyId, societyId),
        eq(societyLedger.referenceType, referenceType),
        eq(societyLedger.referenceId, referenceId)
      )
    )
    .limit(1);
  return Boolean(row);
}

async function insertLedgerRow(
  executor: AppDatabase,
  row: {
    id?: string;
    societyId: string;
    type: SocietyLedgerType;
    amount: string;
    description?: string | null;
    referenceId?: string | null;
    referenceType?: string | null;
    categoryId?: string | null;
    bookingDate: Date | string;
    isManual: boolean;
    voided: boolean;
    createdBy: string | null;
    createdAt?: Date;
  }
) {
  const booking =
    typeof row.bookingDate === "string" ? row.bookingDate : ymd(row.bookingDate);
  const [r] = await executor
    .insert(societyLedger)
    .values({
      ...(row.id ? { id: row.id } : {}),
      societyId: row.societyId,
      type: row.type,
      amount: row.amount,
      description: row.description ?? null,
      referenceId: row.referenceId ?? null,
      referenceType: row.referenceType ?? null,
      categoryId: row.categoryId ?? null,
      bookingDate: booking,
      isManual: row.isManual,
      voided: row.voided,
      createdBy: row.createdBy,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return r;
}

/**
 * Mirror a member ledger row into the society ledger (idempotent on account_movement id).
 */
export async function mirrorAccountMovementToSocietyLedger(
  executor: AppDatabase,
  movement: {
    id: string;
    societyId: string;
    type: string;
    amount: string;
    description: string | null;
    createdAt: Date;
    createdBy: string | null;
  }
): Promise<void> {
  if (
    await societyLedgerEntryExists(
      movement.societyId,
      SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT,
      movement.id,
      executor
    )
  ) {
    return;
  }

  const amt = parseFloat(String(movement.amount));
  const booking = ymd(movement.createdAt);
  const createdAt = movement.createdAt;

  if (
    (movement.type === "bank_transfer" ||
      movement.type === "sepa_collection" ||
      movement.type === "cash_payment") &&
    amt > 0
  ) {
    const ledgerType: SocietyLedgerType =
      movement.type === "bank_transfer" ? "prepayment" : movement.type;
    await insertLedgerRow(executor, {
      societyId: movement.societyId,
      type: ledgerType,
      amount: formatLedgerAmount(amt),
      description: movement.description,
      referenceId: movement.id,
      referenceType: SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT,
      categoryId: null,
      bookingDate: booking,
      isManual: false,
      voided: false,
      createdBy: movement.createdBy,
      createdAt,
    });
    return;
  }

  if (movement.type === "refund" && amt > 0) {
    await insertLedgerRow(executor, {
      societyId: movement.societyId,
      type: "refund",
      amount: formatLedgerAmount(-amt),
      description: movement.description,
      referenceId: movement.id,
      referenceType: SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT,
      categoryId: null,
      bookingDate: booking,
      isManual: false,
      voided: false,
      createdBy: movement.createdBy,
      createdAt,
    });
    return;
  }

  if (movement.type === "sepa_bounce") {
    await insertLedgerRow(executor, {
      societyId: movement.societyId,
      type: "sepa_bounce",
      amount: formatLedgerAmount(-Math.abs(amt)),
      description: movement.description,
      referenceId: movement.id,
      referenceType: SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT,
      categoryId: null,
      bookingDate: booking,
      isManual: false,
      voided: false,
      createdBy: movement.createdBy,
      createdAt,
    });
  }
}

export async function getSocietyBalance(
  societyId: string,
  executor: AppDatabase = db
): Promise<number> {
  const [row] = await executor
    .select({
      bal: sql<string>`coalesce(sum(cast(${societyLedger.amount} as decimal)), 0)`.mapWith(Number),
    })
    .from(societyLedger)
    .where(
      and(eq(societyLedger.societyId, societyId), eq(societyLedger.voided, false))
    );
  return row?.bal ?? 0;
}

export async function getSocietyBalanceBeforeMonth(
  societyId: string,
  beforeMonth: string,
  executor: AppDatabase = db
): Promise<number> {
  const [row] = await executor
    .select({
      bal: sql<string>`coalesce(sum(cast(${societyLedger.amount} as decimal)), 0)`.mapWith(Number),
    })
    .from(societyLedger)
    .where(
      and(
        eq(societyLedger.societyId, societyId),
        eq(societyLedger.voided, false),
        sql`to_char(${societyLedger.bookingDate}, 'YYYY-MM') < ${beforeMonth}`
      )
    );
  return row?.bal ?? 0;
}

export async function postManualEntry(
  executor: AppDatabase,
  params: {
    societyId: string;
    categoryId: string;
    categoryType: "income" | "expense";
    amount: number;
    description: string | null;
    bookingDate: Date | string;
    createdBy: string;
  }
) {
  if (params.amount <= 0 || !Number.isFinite(params.amount)) {
    throw new LedgerAmountError("Manual entry amount must be positive");
  }
  const signed =
    params.categoryType === "income"
      ? formatLedgerAmount(params.amount)
      : formatLedgerAmount(-params.amount);
  const type: SocietyLedgerType =
    params.categoryType === "income" ? "manual_income" : "manual_expense";

  const row = await insertLedgerRow(executor, {
    societyId: params.societyId,
    type,
    amount: signed,
    description: params.description,
    referenceId: null,
    referenceType: SOCIETY_LEDGER_REF_MANUAL_ENTRY,
    categoryId: params.categoryId,
    bookingDate: params.bookingDate,
    isManual: true,
    voided: false,
    createdBy: params.createdBy,
  });

  await executor
    .update(societyLedger)
    .set({ referenceId: row.id, updatedAt: new Date() })
    .where(eq(societyLedger.id, row.id));

  const [updated] = await executor
    .select()
    .from(societyLedger)
    .where(eq(societyLedger.id, row.id));
  return updated!;
}

export async function editManualEntry(
  executor: AppDatabase,
  params: {
    societyId: string;
    entryId: string;
    categoryId: string;
    categoryType: "income" | "expense";
    amount: number;
    description: string | null;
    bookingDate: Date | string;
    createdBy: string;
  }
) {
  const [existing] = await executor
    .select()
    .from(societyLedger)
    .where(
      and(
        eq(societyLedger.id, params.entryId),
        eq(societyLedger.societyId, params.societyId),
        inArray(societyLedger.type, [...MANUAL_PRIMARY]),
        eq(societyLedger.voided, false)
      )
    );
  if (!existing) {
    return { error: "not_found" as const };
  }

  const oldSigned = parseFloat(String(existing.amount));
  const newSigned =
    params.categoryType === "income" ? params.amount : -params.amount;
  const delta = newSigned - oldSigned;

  if (Math.abs(delta) > 1e-9) {
    await insertLedgerRow(executor, {
      societyId: params.societyId,
      type: "manual_adjustment",
      amount: formatLedgerAmount(delta),
      description: `Adjustment (entry ${params.entryId})`,
      referenceId: params.entryId,
      referenceType: SOCIETY_LEDGER_REF_MANUAL_ENTRY,
      categoryId: params.categoryId,
      bookingDate: params.bookingDate,
      isManual: true,
      voided: false,
      createdBy: params.createdBy,
    });
  }

  const type: SocietyLedgerType =
    params.categoryType === "income" ? "manual_income" : "manual_expense";
  const amountStr =
    params.categoryType === "income"
      ? formatLedgerAmount(params.amount)
      : formatLedgerAmount(-params.amount);
  const booking =
    typeof params.bookingDate === "string"
      ? params.bookingDate
      : ymd(params.bookingDate);

  const [updated] = await executor
    .update(societyLedger)
    .set({
      categoryId: params.categoryId,
      type,
      amount: amountStr,
      description: params.description ?? null,
      bookingDate: booking,
      updatedAt: new Date(),
    })
    .where(eq(societyLedger.id, params.entryId))
    .returning();

  return { row: updated! };
}

export async function deleteManualEntry(
  executor: AppDatabase,
  params: {
    societyId: string;
    entryId: string;
    createdBy: string;
  }
) {
  const [existing] = await executor
    .select()
    .from(societyLedger)
    .where(
      and(
        eq(societyLedger.id, params.entryId),
        eq(societyLedger.societyId, params.societyId),
        inArray(societyLedger.type, [...MANUAL_PRIMARY]),
        eq(societyLedger.voided, false)
      )
    );
  if (!existing) {
    return { error: "not_found" as const };
  }

  const oldSigned = parseFloat(String(existing.amount));
  await insertLedgerRow(executor, {
    societyId: params.societyId,
    type: "manual_adjustment",
    amount: formatLedgerAmount(-oldSigned),
    description: `Reversal (entry ${params.entryId})`,
    referenceId: params.entryId,
    referenceType: SOCIETY_LEDGER_REF_MANUAL_ENTRY,
    categoryId: existing.categoryId,
    bookingDate: existing.bookingDate,
    isManual: true,
    voided: false,
    createdBy: params.createdBy,
  });

  await executor
    .update(societyLedger)
    .set({ voided: true, updatedAt: new Date() })
    .where(eq(societyLedger.id, params.entryId));

  return { ok: true as const };
}

export async function countManualEntriesForCategory(
  categoryId: string,
  societyId: string,
  executor: AppDatabase = db
): Promise<number> {
  const [{ n }] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(societyLedger)
    .where(
      and(
        eq(societyLedger.societyId, societyId),
        eq(societyLedger.categoryId, categoryId),
        inArray(societyLedger.type, [...MANUAL_PRIMARY]),
        eq(societyLedger.voided, false)
      )
    );
  return Number(n ?? 0);
}
