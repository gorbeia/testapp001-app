import { and, eq, sql, inArray } from "drizzle-orm";
import { db, type AppDatabase } from "../db";
import { accountMovements, users, type AccountMovementType } from "@shared/schema";

/**
 * Member **account balance** from ledger movements (sum of `amount`).
 * Negative means the member owes; positive means prepaid/credit.
 */
export async function getMemberAccountBalance(
  societyId: string,
  userId: string,
  executor: AppDatabase = db
): Promise<number> {
  const [row] = await executor
    .select({
      bal: sql<string>`coalesce(sum(cast(${accountMovements.amount} as decimal)), 0)`.mapWith(
        Number
      ),
    })
    .from(accountMovements)
    .where(and(eq(accountMovements.societyId, societyId), eq(accountMovements.userId, userId)));
  return row?.bal ?? 0;
}

const MONTH_YM = /^\d{4}-\d{2}$/;

function assertYm(label: string, value: string): void {
  if (!MONTH_YM.test(value)) {
    throw new RangeError(`${label} must be YYYY-MM`);
  }
}

/**
 * Sum of movements for a member **strictly before** a calendar month (`YYYY-MM`),
 * matching `to_char(created_at, 'YYYY-MM')` month bucketing used elsewhere.
 */
export async function getMemberBalanceBeforeMonth(
  societyId: string,
  userId: string,
  beforeMonth: string,
  executor: AppDatabase = db
): Promise<number> {
  assertYm("beforeMonth", beforeMonth);
  const [row] = await executor
    .select({
      bal: sql<string>`coalesce(sum(cast(${accountMovements.amount} as decimal)), 0)`.mapWith(
        Number
      ),
    })
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.societyId, societyId),
        eq(accountMovements.userId, userId),
        sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') < ${beforeMonth}`
      )
    );
  return row?.bal ?? 0;
}

/**
 * Member balance at end of `inclusiveMonth` (`YYYY-MM`), or full ledger sum when `inclusiveMonth` is null.
 */
export async function getMemberBalanceThroughMonth(
  societyId: string,
  userId: string,
  inclusiveMonth: string | null,
  executor: AppDatabase = db
): Promise<number> {
  if (inclusiveMonth === null) {
    return getMemberAccountBalance(societyId, userId, executor);
  }
  assertYm("inclusiveMonth", inclusiveMonth);
  const [row] = await executor
    .select({
      bal: sql<string>`coalesce(sum(cast(${accountMovements.amount} as decimal)), 0)`.mapWith(
        Number
      ),
    })
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.societyId, societyId),
        eq(accountMovements.userId, userId),
        sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') <= ${inclusiveMonth}`
      )
    );
  return row?.bal ?? 0;
}

export type MemberBalanceRow = {
  userId: string;
  name: string | null;
  username: string;
  balance: number;
};

/**
 * Ledger balance per **active** society member. When `asOfMonth` is set, uses movements
 * with `to_char(created_at, 'YYYY-MM') <= asOfMonth`; when null, uses full history.
 */
export async function getAllMemberBalances(
  societyId: string,
  asOfMonth: string | null,
  executor: AppDatabase = db
): Promise<{ members: MemberBalanceRow[]; totalBalance: number }> {
  if (asOfMonth !== null) assertYm("asOfMonth", asOfMonth);

  const memberRows = await executor
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(eq(users.societyId, societyId), eq(users.isActive, true)))
    .orderBy(users.name, users.username);

  if (memberRows.length === 0) {
    return { members: [], totalBalance: 0 };
  }

  const ids = memberRows.map(r => r.id);

  const sumExpr =
    sql<string>`coalesce(sum(cast(${accountMovements.amount} as decimal)), 0)`.mapWith(Number);

  const movementConditions =
    asOfMonth === null
      ? and(eq(accountMovements.societyId, societyId), inArray(accountMovements.userId, ids))
      : and(
          eq(accountMovements.societyId, societyId),
          inArray(accountMovements.userId, ids),
          sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') <= ${asOfMonth}`
        );

  const sums = await executor
    .select({
      userId: accountMovements.userId,
      bal: sumExpr,
    })
    .from(accountMovements)
    .where(movementConditions)
    .groupBy(accountMovements.userId);

  const balByUser = new Map(sums.map(s => [s.userId, s.bal ?? 0]));

  const members: MemberBalanceRow[] = memberRows.map(u => ({
    userId: u.id,
    name: u.name,
    username: u.username,
    balance: balByUser.get(u.id) ?? 0,
  }));

  const totalBalance = members.reduce((s, m) => s + m.balance, 0);
  return { members, totalBalance };
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

export async function insertAccountMovementRow(
  input: InsertMovementInput,
  executor: AppDatabase = db
) {
  const [row] = await executor
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
  referenceId: string,
  executor: AppDatabase = db
): Promise<boolean> {
  const [row] = await executor
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
