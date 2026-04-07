import { eq } from "drizzle-orm";
import {
  ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
  ACCOUNT_MOVEMENT_REF_RESERVATION_CASH_CANCEL,
  ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
  bankTransfers,
  credits,
  type Reservation,
} from "@shared/schema";
import { db, type AppDatabase } from "../../db";
import { insertAccountMovementRow, movementExistsForReference } from "../account-movements";
import {
  formatLedgerAmount,
  signedAmountForCreditType,
  signedAmountForDebitType,
} from "./ledger-rules";

export type CreditRow = typeof credits.$inferSelect;

/** Idempotency: one bounce per credit (`account_movements.reference_type`) */
export const REF_TYPE_SEPA_BOUNCE = "sepa_bounce";

/** Posted member refund; returns the inserted row (e.g. for notifications). */
export async function postLedgerRefund(params: {
  societyId: string;
  userId: string;
  amount: number;
  description: string;
  createdBy: string;
}) {
  return db.transaction(async tx => {
    return insertAccountMovementRow(
      {
        societyId: params.societyId,
        userId: params.userId,
        type: "refund",
        amount: signedAmountForCreditType(params.amount, "refund"),
        description: params.description,
        referenceId: null,
        referenceType: null,
        createdBy: params.createdBy,
      },
      tx
    );
  });
}

/** Single consumption line debit. */
export async function postConsumptionDebit(params: {
  societyId: string;
  userId: string;
  totalPrice: number;
  description: string;
  referenceId: string;
  createdBy: string;
}) {
  return db.transaction(async tx => {
    return insertAccountMovementRow(
      {
        societyId: params.societyId,
        userId: params.userId,
        type: "consumption",
        amount: signedAmountForDebitType(params.totalPrice, "consumption"),
        description: params.description,
        referenceId: params.referenceId,
        referenceType: "consumption_item",
        createdBy: params.createdBy,
      },
      tx
    );
  });
}

/**
 * Validates a pending prepayment and posts the ledger line + links `bank_transfers.movementId` atomically.
 */
export async function validateBankTransferAndPostLedger(params: {
  societyId: string;
  bankTransferId: string;
  userId: string;
  amount: number;
  referenceNote: string | null;
  validatedByUserId: string;
}): Promise<{ movementId: string }> {
  const ledgerAmount = formatLedgerAmount(params.amount);
  return db.transaction(async tx => {
    const movement = await insertAccountMovementRow(
      {
        societyId: params.societyId,
        userId: params.userId,
        type: "bank_transfer",
        amount: ledgerAmount,
        description: params.referenceNote
          ? `Prepayment: ${params.referenceNote}`
          : "Prepayment validated",
        referenceId: params.bankTransferId,
        referenceType: "bank_transfer",
        createdBy: params.validatedByUserId,
      },
      tx
    );
    await tx
      .update(bankTransfers)
      .set({
        status: "validated",
        validatedBy: params.validatedByUserId,
        validatedAt: new Date(),
        movementId: movement.id,
        updatedAt: new Date(),
      })
      .where(eq(bankTransfers.id, params.bankTransferId));
    return { movementId: movement.id };
  });
}

export async function postSepaBounceAndResetCredit(params: {
  societyId: string;
  credit: CreditRow;
  createdBy: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof insertAccountMovementRow>>>> {
  const refId = params.credit.id;
  return db.transaction(async tx => {
    const already = await movementExistsForReference(
      params.societyId,
      REF_TYPE_SEPA_BOUNCE,
      refId,
      tx
    );
    if (already) {
      throw new Error("Bounce already recorded for this credit");
    }
    const amountNum = parseFloat(String(params.credit.totalAmount));
    const movement = await insertAccountMovementRow(
      {
        societyId: params.societyId,
        userId: params.credit.memberId,
        type: "sepa_bounce",
        amount: signedAmountForDebitType(amountNum, "sepa_bounce"),
        description: `SEPA bounce — ${params.credit.month}`,
        referenceId: refId,
        referenceType: REF_TYPE_SEPA_BOUNCE,
        createdBy: params.createdBy,
      },
      tx
    );
    if (!movement) {
      throw new Error("Failed to insert SEPA bounce movement");
    }
    await tx
      .update(credits)
      .set({
        status: "pending",
        markedAsPaidBy: null,
        markedAsPaidAt: null,
        updatedAt: new Date(),
      })
      .where(eq(credits.id, params.credit.id));
    return movement;
  });
}

export async function bounceAlreadyRecorded(
  societyId: string,
  creditId: string,
  executor: AppDatabase = db
): Promise<boolean> {
  return movementExistsForReference(societyId, REF_TYPE_SEPA_BOUNCE, creditId, executor);
}

/**
 * After credits are marked paid, append `sepa_collection` rows (idempotent per credit).
 * Call inside the **same** DB transaction as the credit update.
 */
export async function appendSepaCollectionMovementsForCredits(
  tx: AppDatabase,
  params: {
    societyId: string;
    credits: CreditRow[];
    createdBy: string;
  }
): Promise<void> {
  for (const credit of params.credits) {
    const exists = await movementExistsForReference(params.societyId, "credit", credit.id, tx);
    if (exists) continue;
    const amt = parseFloat(String(credit.totalAmount));
    if (amt <= 0) continue;
    await insertAccountMovementRow(
      {
        societyId: params.societyId,
        userId: credit.memberId,
        type: "sepa_collection",
        amount: signedAmountForCreditType(amt, "sepa_collection"),
        description: `SEPA collection — ${credit.month}`,
        referenceId: credit.id,
        referenceType: "credit",
        createdBy: params.createdBy,
      },
      tx
    );
  }
}

/** Reservation cash at bar: optional `reservation` debit + `cash_payment` leg, atomically per reservation. */
export async function postCashReservationSettlement(params: {
  societyId: string;
  userId: string;
  reservationId: string;
  totalAmount: number;
  reservationName: string;
  createdBy: string;
}): Promise<{ cashPaymentMovementId: string }> {
  return db.transaction(async tx => {
    const { societyId, userId, reservationId, totalAmount, reservationName, createdBy } = params;
    const amt = totalAmount;
    if (!(await movementExistsForReference(societyId, "reservation", reservationId, tx))) {
      await insertAccountMovementRow(
        {
          societyId,
          userId,
          type: "reservation",
          amount: signedAmountForDebitType(amt, "reservation"),
          description: `Reservation: ${reservationName}`,
          referenceId: reservationId,
          referenceType: "reservation",
          createdBy,
        },
        tx
      );
    }
    const row = await insertAccountMovementRow(
      {
        societyId,
        userId,
        type: "cash_payment",
        amount: signedAmountForCreditType(amt, "cash_payment"),
        description: `Cash — reservation: ${reservationName}`,
        referenceId: reservationId,
        referenceType: ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
        createdBy,
      },
      tx
    );
    return { cashPaymentMovementId: row.id };
  });
}

export async function postCashSubscriptionSettlement(params: {
  societyId: string;
  userId: string;
  month: string;
  subRef: string;
  amount: number;
  createdBy: string;
}): Promise<{ movementId: string } | { skipped: true }> {
  return db.transaction(async tx => {
    if (
      await movementExistsForReference(
        params.societyId,
        ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
        params.subRef,
        tx
      )
    ) {
      return { skipped: true };
    }
    const row = await insertAccountMovementRow(
      {
        societyId: params.societyId,
        userId: params.userId,
        type: "cash_payment",
        amount: signedAmountForCreditType(params.amount, "cash_payment"),
        description: `Cash — subscription ${params.month}`,
        referenceId: params.subRef,
        referenceType: ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
        createdBy: params.createdBy,
      },
      tx
    );
    return { movementId: row.id };
  });
}

export async function maybePostSubscriptionCharge(params: {
  societyId: string;
  userId: string;
  monthLabel: string;
  subRef: string;
  subscriptionCharge: number;
  createdAt: Date;
}): Promise<{ inserted: boolean }> {
  const { societyId, userId, monthLabel, subRef, subscriptionCharge, createdAt } = params;
  if (subscriptionCharge <= 0) return { inserted: false };
  return db.transaction(async tx => {
    const exists = await movementExistsForReference(societyId, "subscription", subRef, tx);
    if (exists) return { inserted: false };
    await insertAccountMovementRow(
      {
        societyId,
        userId,
        type: "subscription",
        amount: signedAmountForDebitType(subscriptionCharge, "subscription"),
        description: `Subscription — ${monthLabel}`,
        referenceId: subRef,
        referenceType: "subscription",
        createdBy: null,
        createdAt,
      },
      tx
    );
    return { inserted: true };
  });
}

export async function maybePostReservationCharge(params: {
  societyId: string;
  userId: string;
  reservationId: string;
  amount: number;
  reservationName: string;
  createdAt: Date;
}): Promise<{ inserted: boolean }> {
  const { societyId, userId, reservationId, amount, reservationName, createdAt } = params;
  if (!Number.isFinite(amount) || amount <= 0) return { inserted: false };
  return db.transaction(async tx => {
    const existsCharge = await movementExistsForReference(
      societyId,
      "reservation",
      reservationId,
      tx
    );
    if (existsCharge) return { inserted: false };
    await insertAccountMovementRow(
      {
        societyId,
        userId,
        type: "reservation",
        amount: signedAmountForDebitType(amount, "reservation"),
        description: `Reservation: ${reservationName}`,
        referenceId: reservationId,
        referenceType: "reservation",
        createdBy: null,
        createdAt,
      },
      tx
    );
    return { inserted: true };
  });
}

/** Reverse reservation charge and/or cash-settlement legs when cancelling or deleting. */
export async function reverseReservationLedgerOnCancel(params: {
  societyId: string;
  pre: Reservation;
  cancelledByUserId: string;
  cancelDescriptionPrefix: "Reservation cancelled:" | "Reservation deleted:";
}): Promise<void> {
  const { societyId, pre, cancelledByUserId, cancelDescriptionPrefix } = params;
  const preTotal = parseFloat(pre.totalAmount || "0");
  if (preTotal <= 0) return;

  await db.transaction(async tx => {
    const hasReservationCharge = await movementExistsForReference(
      societyId,
      "reservation",
      pre.id,
      tx
    );
    const hasCashPayment = await movementExistsForReference(
      societyId,
      ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
      pre.id,
      tx
    );

    if (
      hasReservationCharge &&
      !(await movementExistsForReference(societyId, "reservation_cancel", pre.id, tx))
    ) {
      await insertAccountMovementRow(
        {
          societyId,
          userId: pre.userId,
          type: "adjustment",
          amount: formatLedgerAmount(preTotal),
          description: `${cancelDescriptionPrefix} ${pre.name}`,
          referenceId: pre.id,
          referenceType: "reservation_cancel",
          createdBy: cancelledByUserId,
        },
        tx
      );
    }

    if (
      hasCashPayment &&
      !(await movementExistsForReference(
        societyId,
        ACCOUNT_MOVEMENT_REF_RESERVATION_CASH_CANCEL,
        pre.id,
        tx
      ))
    ) {
      await insertAccountMovementRow(
        {
          societyId,
          userId: pre.userId,
          type: "adjustment",
          amount: formatLedgerAmount(-preTotal),
          description:
            cancelDescriptionPrefix === "Reservation cancelled:"
              ? `Reservation cancelled (cash reversal): ${pre.name}`
              : `Reservation deleted (cash reversal): ${pre.name}`,
          referenceId: pre.id,
          referenceType: ACCOUNT_MOVEMENT_REF_RESERVATION_CASH_CANCEL,
          createdBy: cancelledByUserId,
        },
        tx
      );
    }
  });
}

export const ledgerService = {
  postLedgerRefund,
  postConsumptionDebit,
  validateBankTransferAndPostLedger,
  postSepaBounceAndResetCredit,
  bounceAlreadyRecorded,
  appendSepaCollectionMovementsForCredits,
  postCashReservationSettlement,
  postCashSubscriptionSettlement,
  maybePostSubscriptionCharge,
  maybePostReservationCharge,
  reverseReservationLedgerOnCancel,
  REF_TYPE_SEPA_BOUNCE,
};
