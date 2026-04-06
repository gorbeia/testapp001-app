import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accountMovements,
  societies,
  type AccountMovementType,
} from "@shared/schema";

export async function getMemberLedgerBalance(
  societyId: string,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({
      bal: sql<string>`coalesce(sum(cast(${accountMovements.amount} as decimal)), 0)`.mapWith(
        Number
      ),
    })
    .from(accountMovements)
    .where(
      and(eq(accountMovements.societyId, societyId), eq(accountMovements.userId, userId))
    );
  return row?.bal ?? 0;
}

/** Throws if society disallows prepaid credit (balance < 0). */
export async function assertBalanceAllowsMovement(
  societyId: string,
  userId: string,
  movementAmount: string | number,
  currentBalance?: number
): Promise<void> {
  const [soc] = await db
    .select({ allowPositiveBalance: societies.allowPositiveBalance })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  if (!soc?.allowPositiveBalance) {
    const bal =
      currentBalance !== undefined
        ? currentBalance
        : await getMemberLedgerBalance(societyId, userId);
    const delta = typeof movementAmount === "string" ? parseFloat(movementAmount) : movementAmount;
    const next = bal + delta;
    if (next < -1e-6) {
      const err = new Error("PREPAID_NOT_ALLOWED");
      (err as Error & { status?: number }).status = 400;
      throw err;
    }
  }
}

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
