import { describe, expect, it } from "vitest";
import type { AccountMovementType } from "@shared/schema";
import {
  LedgerAmountError,
  PREPAYMENT_FLOOR_EPS,
  balanceMultiplierForMovementType,
  computeRunningBalances,
  computeRunningBalancesWithInitial,
  formatLedgerAmount,
  isFloorBreachedAfterDebit,
  isFloorBreachedWithZeroDebit,
  projectedBalance,
  signedAmountForCreditType,
  signedAmountForDebitType,
} from "./ledger-rules";

describe("formatLedgerAmount", () => {
  it("formats two decimals", () => {
    expect(formatLedgerAmount(1)).toBe("1.00");
    expect(formatLedgerAmount(3.14159)).toBe("3.14");
  });
  it("rejects non-finite", () => {
    expect(() => formatLedgerAmount(NaN)).toThrow(LedgerAmountError);
    expect(() => formatLedgerAmount(Number.POSITIVE_INFINITY)).toThrow(LedgerAmountError);
  });
});

describe("balanceMultiplierForMovementType", () => {
  it("negative balance delta families", () => {
    const neg: AccountMovementType[] = [
      "consumption",
      "reservation",
      "subscription",
      "sepa_bounce",
    ];
    for (const t of neg) {
      expect(balanceMultiplierForMovementType(t)).toBe(-1);
    }
  });
  it("positive balance delta families", () => {
    const pos: AccountMovementType[] = [
      "bank_transfer",
      "sepa_collection",
      "cash_payment",
      "refund",
    ];
    for (const t of pos) {
      expect(balanceMultiplierForMovementType(t)).toBe(1);
    }
  });
  it("adjustment is contextual", () => {
    expect(balanceMultiplierForMovementType("adjustment")).toBeNull();
  });
});

describe("signedAmountForDebitType / signedAmountForCreditType", () => {
  it("produces negative amounts for debits", () => {
    expect(signedAmountForDebitType(10.5, "consumption")).toBe("-10.50");
    expect(signedAmountForDebitType(0, "reservation")).toBe("0.00");
  });
  it("rejects wrong kind", () => {
    expect(() => signedAmountForDebitType(1, "refund")).toThrow(LedgerAmountError);
    expect(() => signedAmountForCreditType(1, "consumption")).toThrow(LedgerAmountError);
  });
  it("produces positive amounts for credits", () => {
    expect(signedAmountForCreditType(10.5, "bank_transfer")).toBe("10.50");
  });
  it("rejects negative magnitude", () => {
    expect(() => signedAmountForDebitType(-1, "subscription")).toThrow(LedgerAmountError);
    expect(() => signedAmountForCreditType(-1, "refund")).toThrow(LedgerAmountError);
  });
});

describe("computeRunningBalances", () => {
  it("returns empty for empty input", () => {
    expect(computeRunningBalances([])).toEqual([]);
  });
  it("accumulates per user and sorts by time then id", () => {
    const a = new Date("2024-01-01T12:00:00Z");
    const b = new Date("2024-01-02T12:00:00Z");
    const rows = [
      { id: "b", userId: "u1", amount: "5.00", createdAt: b },
      { id: "a", userId: "u1", amount: "-3.00", createdAt: a },
    ];
    const out = computeRunningBalances(rows);
    expect(out).toHaveLength(2);
    const sorted = out.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    expect(sorted[0].runningBalance).toBe(-3);
    expect(sorted[1].runningBalance).toBe(2);
  });
  it("ties break by id", () => {
    const t = new Date("2024-01-01T12:00:00Z");
    const rows = [
      { id: "z", userId: "u1", amount: "1", createdAt: t },
      { id: "a", userId: "u1", amount: "1", createdAt: t },
    ];
    const out = computeRunningBalances(rows);
    const byId = new Map(out.map(r => [r.id, r.runningBalance]));
    expect(byId.get("a")).toBe(1);
    expect(byId.get("z")).toBe(2);
  });
});

describe("computeRunningBalancesWithInitial", () => {
  it("starts from initial balance and sorts by time", () => {
    const d1 = new Date("2024-03-01T10:00:00Z");
    const d2 = new Date("2024-03-02T10:00:00Z");
    const out = computeRunningBalancesWithInitial(
      [
        { id: "b", userId: "u1", amount: "-5.00", createdAt: d2 },
        { id: "a", userId: "u1", amount: "12.00", createdAt: d1 },
      ],
      100
    );
    expect(out.map(r => ({ id: r.id, rb: r.runningBalance }))).toEqual([
      { id: "a", rb: 112 },
      { id: "b", rb: 107 },
    ]);
  });
});

describe("projectedBalance and floor helpers", () => {
  it("projectedBalance subtracts debit", () => {
    expect(projectedBalance(100, 30)).toBe(70);
    expect(projectedBalance(100, 0)).toBe(100);
  });
  it("isFloorBreachedAfterDebit uses epsilon", () => {
    const floor = 10;
    expect(isFloorBreachedAfterDebit(10.5, 0.5, floor)).toBe(false);
    expect(isFloorBreachedAfterDebit(10.5, 0.5 + PREPAYMENT_FLOOR_EPS * 2, floor)).toBe(true);
  });
  it("isFloorBreachedWithZeroDebit", () => {
    expect(isFloorBreachedWithZeroDebit(10, 10)).toBe(false);
    expect(isFloorBreachedWithZeroDebit(10 - PREPAYMENT_FLOOR_EPS * 2, 10)).toBe(true);
  });
});
