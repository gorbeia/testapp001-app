import type { AccountMovementType } from "@shared/schema";

/** Matches prepayment floor checks in prepayment-ledger-floor.ts */
export const PREPAYMENT_FLOOR_EPS = 1e-6;

export class LedgerAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerAmountError";
  }
}

/**
 * Canonical ledger amount string (two decimal places).
 * Rejects NaN and non-finite values.
 */
export function formatLedgerAmount(n: number): string {
  if (!Number.isFinite(n)) {
    throw new LedgerAmountError("Amount must be a finite number");
  }
  return n.toFixed(2);
}

/**
 * For movement types that always move balance in one direction in the stored `amount` sign
 * (see docs/features/account-movements.md). `adjustment` is contextual — use explicit amounts.
 */
export function balanceMultiplierForMovementType(type: AccountMovementType): 1 | -1 | null {
  switch (type) {
    case "consumption":
    case "reservation":
    case "subscription":
    case "sepa_bounce":
      return -1;
    case "bank_transfer":
    case "sepa_collection":
    case "cash_payment":
    case "refund":
      return 1;
    case "adjustment":
      return null;
  }
}

/** Signed ledger `amount` from an absolute currency magnitude and movement kind. */
export function signedAmountForDebitType(absAmount: number, type: AccountMovementType): string {
  if (absAmount < 0 || !Number.isFinite(absAmount)) {
    throw new LedgerAmountError("Debit magnitude must be a non-negative finite number");
  }
  const mult = balanceMultiplierForMovementType(type);
  if (mult !== -1) {
    throw new LedgerAmountError(`Expected a debit movement type, got ${type}`);
  }
  return formatLedgerAmount(mult * absAmount);
}

/** Signed ledger `amount` for credit-style movement types (positive in DB). */
export function signedAmountForCreditType(absAmount: number, type: AccountMovementType): string {
  if (absAmount < 0 || !Number.isFinite(absAmount)) {
    throw new LedgerAmountError("Credit magnitude must be a non-negative finite number");
  }
  const mult = balanceMultiplierForMovementType(type);
  if (mult !== 1) {
    throw new LedgerAmountError(`Expected a credit movement type, got ${type}`);
  }
  return formatLedgerAmount(mult * absAmount);
}

export type MovementForRunningBalance = {
  id: string;
  userId: string;
  amount: string;
  createdAt: Date;
};

export function computeRunningBalances<T extends MovementForRunningBalance>(
  rows: T[]
): (T & { runningBalance: number })[] {
  const sorted = [...rows].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  const byUser = new Map<string, number>();
  const out: (T & { runningBalance: number })[] = [];
  for (const r of sorted) {
    const prev = byUser.get(r.userId) ?? 0;
    const amt = parseFloat(String(r.amount));
    const next = prev + amt;
    byUser.set(r.userId, next);
    out.push({ ...r, runningBalance: next });
  }
  return out;
}

export function projectedBalance(balanceBefore: number, debitTotal: number): number {
  return balanceBefore - debitTotal;
}

/**
 * True if balance after debiting would be strictly below the prepayment floor
 * (same epsilon rule as assertPrepaymentDebitAllowed for debitTotal > 0).
 */
export function isFloorBreachedAfterDebit(
  balanceBefore: number,
  debitTotal: number,
  floor: number
): boolean {
  const projected = projectedBalance(balanceBefore, debitTotal);
  return projected + PREPAYMENT_FLOOR_EPS < floor;
}

/**
 * When debitTotal <= 0 (e.g. consumption path checks “already below floor?”),
 * breach means current balance is strictly below floor.
 */
export function isFloorBreachedWithZeroDebit(balanceBefore: number, floor: number): boolean {
  return balanceBefore + PREPAYMENT_FLOOR_EPS < floor;
}
