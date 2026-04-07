import { eq } from "drizzle-orm";
import { db } from "../db";
import { societies, societyAllowsBankTransferPrepayment } from "@shared/schema";
import { getMemberAccountBalance } from "./account-movements";
import { notifyFinancialEvent } from "./financial-notifications";
import { isFloorBreachedAfterDebit, isFloorBreachedWithZeroDebit } from "./ledger/ledger-rules";

export async function getEffectivePrepaymentFloor(societyId: string): Promise<number | null> {
  const [row] = await db
    .select({
      paymentMethods: societies.paymentMethods,
      prepaymentMinLedgerBalance: societies.prepaymentMinLedgerBalance,
    })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  if (!row) return null;
  if (!societyAllowsBankTransferPrepayment(row.paymentMethods)) return null;
  const raw = row.prepaymentMinLedgerBalance;
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n)) return null;
  return n;
}

export type PrepaymentDebitDenied = {
  allowed: false;
  floor: number;
  balance: number;
  debitTotal: number;
  projected: number;
};

export type PrepaymentDebitOk = {
  allowed: true;
  balanceBefore: number;
  floor: number | null;
};

export async function assertPrepaymentDebitAllowed(
  societyId: string,
  userId: string,
  debitTotal: number
): Promise<PrepaymentDebitDenied | PrepaymentDebitOk> {
  const floor = await getEffectivePrepaymentFloor(societyId);
  const balanceBefore = await getMemberAccountBalance(societyId, userId);

  if (floor === null) {
    return { allowed: true, balanceBefore, floor: null };
  }

  if (debitTotal <= 0) {
    if (isFloorBreachedWithZeroDebit(balanceBefore, floor)) {
      return {
        allowed: false,
        floor,
        balance: balanceBefore,
        debitTotal: 0,
        projected: balanceBefore,
      };
    }
    return { allowed: true, balanceBefore, floor };
  }

  const projected = balanceBefore - debitTotal;
  if (isFloorBreachedAfterDebit(balanceBefore, debitTotal, floor)) {
    return {
      allowed: false,
      floor,
      balance: balanceBefore,
      debitTotal,
      projected,
    };
  }

  return { allowed: true, balanceBefore, floor };
}

export function prepaymentFloorHttpBody(denied: PrepaymentDebitDenied) {
  return {
    code: "prepayment_ledger_floor" as const,
    message:
      "Saldoa ez dago elkarteak onartutako gutxienekoaren gainean. Osatu saldoa aurreordainketarekin.",
    floor: denied.floor,
    balance: denied.balance,
    debitTotal: denied.debitTotal,
    projected: denied.projected,
  };
}

/**
 * Notify once when a debit pushes the member from at/above the floor to strictly below.
 */
export async function notifyIfCrossedPrepaymentFloor(opts: {
  societyId: string;
  userId: string;
  balanceBefore: number;
  debitTotal: number;
}): Promise<void> {
  const floor = await getEffectivePrepaymentFloor(opts.societyId);
  if (floor === null) return;

  const after = opts.balanceBefore - opts.debitTotal;
  if (
    !isFloorBreachedWithZeroDebit(opts.balanceBefore, floor) &&
    isFloorBreachedWithZeroDebit(after, floor)
  ) {
    await notifyFinancialEvent({
      userId: opts.userId,
      societyId: opts.societyId,
      titleKey: "financialPrepaymentFloorBreachedTitle",
      messageKey: "financialPrepaymentFloorBreachedMessage",
      params: {
        floor: floor.toFixed(2),
        balance: after.toFixed(2),
      },
    });
  }
}
