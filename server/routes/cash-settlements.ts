import type { Express, Request, Response, NextFunction } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
  ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
  cashSettlementBodySchema,
  credits,
  reservations,
  societies,
  societyAllowsCashPayment,
  type JwtSessionUser,
} from "@shared/schema";
import { sessionMiddleware, requireAuth } from "./middleware";
import { insertAccountMovementRow, movementExistsForReference } from "../lib/account-movements";
import { debtCalculationService } from "../cron-jobs";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
};

async function societyAllowsCash(societyId: string): Promise<boolean> {
  const [row] = await db
    .select({ paymentMethods: societies.paymentMethods })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  if (!row) return false;
  return societyAllowsCashPayment(row.paymentMethods);
}

export function registerCashSettlementRoutes(app: Express) {
  app.get(
    "/api/me/pending-cash-items",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        if (!(await societyAllowsCash(societyId))) {
          return res.status(403).json({ message: "Cash payment is not enabled for this society" });
        }

        const candidateReservations = await db
          .select({
            id: reservations.id,
            name: reservations.name,
            status: reservations.status,
            startDate: reservations.startDate,
            totalAmount: reservations.totalAmount,
          })
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, user.id),
              eq(reservations.societyId, societyId),
              inArray(reservations.status, ["confirmed", "completed"]),
              sql`CAST(${reservations.totalAmount} AS DECIMAL) > 0`
            )
          )
          .orderBy(reservations.startDate);

        const unpaidReservations: typeof candidateReservations = [];
        for (const r of candidateReservations) {
          if (
            await movementExistsForReference(societyId, ACCOUNT_MOVEMENT_REF_RESERVATION_CASH, r.id)
          ) {
            continue;
          }
          unpaidReservations.push(r);
        }

        const creditRows = await db
          .select({
            id: credits.id,
            month: credits.month,
            subscriptionAmount: credits.subscriptionAmount,
          })
          .from(credits)
          .where(
            and(
              eq(credits.memberId, user.id),
              eq(credits.societyId, societyId),
              eq(credits.status, "pending"),
              sql`CAST(${credits.subscriptionAmount} AS DECIMAL) > 0`
            )
          )
          .orderBy(credits.year, credits.monthNumber);

        const dueSubscriptions: { creditId: string; month: string; amount: string }[] = [];
        for (const c of creditRows) {
          const subRef = `${user.id}:${c.month}`;
          if (
            await movementExistsForReference(
              societyId,
              ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
              subRef
            )
          ) {
            continue;
          }
          dueSubscriptions.push({
            creditId: c.id,
            month: c.month,
            amount: String(c.subscriptionAmount ?? "0"),
          });
        }

        return res.json({ reservations: unpaidReservations, subscriptions: dueSubscriptions });
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/api/me/cash-settlements",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        if (!(await societyAllowsCash(societyId))) {
          return res.status(403).json({ message: "Cash payment is not enabled for this society" });
        }

        const parsed = cashSettlementBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid cash settlement payload",
            issues: parsed.error.flatten(),
          });
        }

        const { reservationIds = [], subscriptionMonths = [] } = parsed.data;
        const movements: {
          id: string;
          referenceType: string;
          referenceId: string;
          amount: string;
        }[] = [];

        for (const reservationId of reservationIds) {
          const [resRow] = await db
            .select()
            .from(reservations)
            .where(
              and(
                eq(reservations.id, reservationId),
                eq(reservations.userId, user.id),
                eq(reservations.societyId, societyId),
                inArray(reservations.status, ["confirmed", "completed"]),
                sql`CAST(${reservations.totalAmount} AS DECIMAL) > 0`
              )
            )
            .limit(1);

          if (!resRow) {
            return res.status(400).json({ message: `Reservation ${reservationId} is not payable` });
          }

          if (
            await movementExistsForReference(
              societyId,
              ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
              reservationId
            )
          ) {
            continue;
          }

          const amt = parseFloat(String(resRow.totalAmount));
          if (!Number.isFinite(amt) || amt <= 0) {
            return res
              .status(400)
              .json({ message: `Reservation ${reservationId} has invalid amount` });
          }

          if (!(await movementExistsForReference(societyId, "reservation", reservationId))) {
            await insertAccountMovementRow({
              societyId,
              userId: user.id,
              type: "reservation",
              amount: (-amt).toFixed(2),
              description: `Reservation: ${resRow.name}`,
              referenceId: reservationId,
              referenceType: "reservation",
              createdBy: user.id,
            });
          }

          const row = await insertAccountMovementRow({
            societyId,
            userId: user.id,
            type: "cash_payment",
            amount: amt.toFixed(2),
            description: `Cash — reservation: ${resRow.name}`,
            referenceId: reservationId,
            referenceType: ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
            createdBy: user.id,
          });
          movements.push({
            id: row.id,
            referenceType: ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
            referenceId: reservationId,
            amount: amt.toFixed(2),
          });
        }

        for (const month of subscriptionMonths) {
          const subRef = `${user.id}:${month}`;
          if (
            await movementExistsForReference(
              societyId,
              ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
              subRef
            )
          ) {
            continue;
          }

          const [creditRow] = await db
            .select()
            .from(credits)
            .where(
              and(
                eq(credits.memberId, user.id),
                eq(credits.societyId, societyId),
                eq(credits.month, month),
                eq(credits.status, "pending"),
                sql`CAST(${credits.subscriptionAmount} AS DECIMAL) > 0`
              )
            )
            .limit(1);

          if (!creditRow) {
            return res.status(400).json({ message: `No payable subscription for month ${month}` });
          }

          const amt = parseFloat(String(creditRow.subscriptionAmount));
          if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ message: `Invalid subscription amount for ${month}` });
          }

          const row = await insertAccountMovementRow({
            societyId,
            userId: user.id,
            type: "cash_payment",
            amount: amt.toFixed(2),
            description: `Cash — subscription ${month}`,
            referenceId: subRef,
            referenceType: ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
            createdBy: user.id,
          });
          movements.push({
            id: row.id,
            referenceType: ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
            referenceId: subRef,
            amount: amt.toFixed(2),
          });
        }

        if (movements.length > 0) {
          await debtCalculationService.calculateCurrentMonthDebtsForSociety(societyId);
        }

        return res.status(200).json({ movements });
      } catch (e) {
        next(e);
      }
    }
  );
}
