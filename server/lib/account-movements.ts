import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { accountMovements, type AccountMovementType } from "@shared/schema";

/**
 * Member **account balance** from ledger movements (sum of `amount`).
 * Negative means the member owes; positive means prepaid/credit.
 */
export async function getMemberAccountBalance(societyId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({
      bal: sql<string>`coalesce(sum(cast(${accountMovements.amount} as decimal)), 0)`.mapWith(
        Number
      ),
    })
    .from(accountMovements)
    .where(and(eq(accountMovements.societyId, societyId), eq(accountMovements.userId, userId)));
  return row?.bal ?? 0;
}

/** @deprecated Use {@link getMemberAccountBalance}. */
export const getMemberLedgerBalance = getMemberAccountBalance;

export type InsertMovementInput = {
  societyId: string;
  userId: string;
  type: AccountMovementType;
  amount: string; // decimal string
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  createdBy: string | null;
  createdAt?: Date;
};

export async function insertAccountMovementRow(input: InsertMovementInput) {
  const [row] = await db
    .insert(accountMovements)
    .values({
      societyId: input.societyId,
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      description: input.description ?? null,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
      createdBy: input.createdBy,
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();
  return row;
}

/** True if a movement with this reference already exists (idempotency). */
export async function movementExistsForReference(
  societyId: string,
  referenceType: string,
  referenceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: accountMovements.id })
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.societyId, societyId),
        eq(accountMovements.referenceType, referenceType),
        eq(accountMovements.referenceId, referenceId)
      )
    )
    .limit(1);
  return Boolean(row);
}
