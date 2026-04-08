import cron from "node-cron";
import { db } from "./db";
import { eq, and, gte, lte, ne, notExists, sql } from "drizzle-orm";
import {
  users,
  consumptions,
  reservations,
  societies,
  credits,
  subscriptionTypes,
  accountMovements,
  ACCOUNT_MOVEMENT_REF_RESERVATION_CASH,
  ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
  type Society,
} from "@shared/schema";
import { movementExistsForReference } from "./lib/account-movements";
import {
  maybePostReservationCharge,
  maybePostSubscriptionCharge,
} from "./lib/ledger/ledger-service";
import { notifyFinancialEvent } from "./lib/financial-notifications";
import { devLog } from "./lib/dev-log";

class DebtCalculationService {
  private static instance: DebtCalculationService;
  /** Per-society lock so parallel runs for different tenants are allowed. */
  private runningSocietyIds = new Set<string>();

  private constructor() {}

  static getInstance(): DebtCalculationService {
    if (!DebtCalculationService.instance) {
      DebtCalculationService.instance = new DebtCalculationService();
    }
    return DebtCalculationService.instance;
  }

  private acquireLock(societyId: string): boolean {
    if (this.runningSocietyIds.has(societyId)) {
      return false;
    }
    this.runningSocietyIds.add(societyId);
    return true;
  }

  private releaseLock(societyId: string): void {
    this.runningSocietyIds.delete(societyId);
  }

  /**
   * Run debt aggregation for one tenant (monthly credits + optional subscription ledger).
   */
  async calculateMonthlyDebtsForSociety(
    societyId: string,
    year: number,
    month: number
  ): Promise<void> {
    if (!this.acquireLock(societyId)) {
      devLog(
        `[${new Date().toISOString()}] Debt calculation already in progress for society ${societyId}, skipping...`
      );
      return;
    }

    const monthString = month.toString().padStart(2, "0");
    const monthLabel = `${year}-${monthString}`;

    devLog(
      `[${new Date().toISOString()}] Starting debt calculation for society ${societyId}, ${monthLabel}...`
    );

    try {
      const [society] = await db
        .select()
        .from(societies)
        .where(eq(societies.id, societyId))
        .limit(1);

      if (!society?.isActive) {
        devLog(`[${new Date().toISOString()}] Society ${societyId} not active, skipping`);
        return;
      }

      await this.runMemberDebtLoop(society, year, month, monthLabel);

      devLog(
        `[${new Date().toISOString()}] Debt calculation completed for society ${societyId}, ${monthLabel}`
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error calculating debts for society ${societyId}, ${monthLabel}:`,
        error
      );
      throw error;
    } finally {
      this.releaseLock(societyId);
    }
  }

  /** Scheduled / catch-up: all active societies. */
  async calculateMonthlyDebtsAllSocieties(year: number, month: number): Promise<void> {
    const active = await db
      .select({ id: societies.id })
      .from(societies)
      .where(eq(societies.isActive, true));

    if (active.length === 0) {
      devLog(`[${new Date().toISOString()}] No active societies for debt calculation`);
      return;
    }

    for (const row of active) {
      try {
        await this.calculateMonthlyDebtsForSociety(row.id, year, month);
      } catch (err) {
        console.error(
          `[${new Date().toISOString()}] Debt calculation failed for society ${row.id}:`,
          err
        );
      }
    }
  }

  private async runMemberDebtLoop(
    activeSociety: Society,
    year: number,
    month: number,
    monthLabel: string
  ): Promise<void> {
    const members = await db
      .select()
      .from(users)
      .where(and(eq(users.societyId, activeSociety.id), eq(users.isActive, true)));
    devLog(`Society ${activeSociety.id}: ${members.length} members to process`);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const now = new Date();

    let totalDebts = 0;
    let processedCount = 0;

    for (const member of members) {
      try {
        const consumptionResults = await db
          .select({
            total: sql`SUM(CAST(${consumptions.totalAmount} AS DECIMAL))`.mapWith(Number),
          })
          .from(consumptions)
          .where(
            and(
              eq(consumptions.userId, member.id),
              eq(consumptions.societyId, activeSociety.id),
              gte(consumptions.createdAt, startDate),
              lte(consumptions.createdAt, endDate)
            )
          );

        const consumptionAmount = consumptionResults[0]?.total || 0;

        const reservationResults = await db
          .select({
            total: sql`SUM(CAST(${reservations.totalAmount} AS DECIMAL))`.mapWith(Number),
          })
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, member.id),
              eq(reservations.societyId, activeSociety.id),
              gte(reservations.startDate, startDate),
              lte(reservations.startDate, endDate),
              lte(reservations.startDate, now),
              ne(reservations.status, "cancelled"),
              notExists(
                db
                  .select()
                  .from(accountMovements)
                  .where(
                    and(
                      eq(accountMovements.societyId, activeSociety.id),
                      eq(accountMovements.referenceType, ACCOUNT_MOVEMENT_REF_RESERVATION_CASH),
                      eq(accountMovements.referenceId, reservations.id)
                    )
                  )
              )
            )
          );

        const reservationAmount = reservationResults[0]?.total || 0;

        const subscriptionCharge = await this.calculateSubscriptionCharge(
          member.id,
          activeSociety.id,
          year,
          month
        );

        const subRef = `${member.id}:${monthLabel}`;
        const subscriptionSettledByCash = await movementExistsForReference(
          activeSociety.id,
          ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH,
          subRef
        );
        const effectiveSubscription = subscriptionSettledByCash ? 0 : subscriptionCharge;

        const totalAmount = consumptionAmount + reservationAmount + effectiveSubscription;

        const [existingCredit] = await db
          .select()
          .from(credits)
          .where(
            and(
              eq(credits.memberId, member.id),
              eq(credits.societyId, activeSociety.id),
              eq(credits.month, monthLabel)
            )
          );

        if (totalAmount > 0) {
          if (existingCredit) {
            await db
              .update(credits)
              .set({
                consumptionAmount: consumptionAmount.toString(),
                reservationAmount: reservationAmount.toString(),
                subscriptionAmount: effectiveSubscription.toString(),
                totalAmount: totalAmount.toString(),
                updatedAt: new Date(),
              })
              .where(eq(credits.id, existingCredit.id));
          } else {
            await db.insert(credits).values({
              memberId: member.id,
              societyId: activeSociety.id,
              month: monthLabel,
              year,
              monthNumber: month,
              consumptionAmount: consumptionAmount.toString(),
              reservationAmount: reservationAmount.toString(),
              subscriptionAmount: effectiveSubscription.toString(),
              totalAmount: totalAmount.toString(),
              status: "pending",
            });
          }

          devLog(
            `[${activeSociety.id}] ${member.name}: ${totalAmount.toFixed(2)}€ (consumption: ${consumptionAmount.toFixed(2)}€, reservation: ${reservationAmount.toFixed(2)}€, subscription: ${effectiveSubscription.toFixed(2)}€)`
          );
        } else if (existingCredit) {
          await db
            .update(credits)
            .set({
              consumptionAmount: consumptionAmount.toString(),
              reservationAmount: reservationAmount.toString(),
              subscriptionAmount: effectiveSubscription.toString(),
              totalAmount: "0",
              updatedAt: new Date(),
            })
            .where(eq(credits.id, existingCredit.id));
        }

        if (subscriptionCharge > 0) {
          const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
          const { inserted } = await maybePostSubscriptionCharge({
            societyId: activeSociety.id,
            userId: member.id,
            monthLabel,
            subRef,
            subscriptionCharge,
            createdAt: endOfMonth,
          });
          if (inserted) {
            try {
              await notifyFinancialEvent({
                userId: member.id,
                societyId: activeSociety.id,
                referenceId: subRef,
                titleKey: "financialSubscriptionChargeTitle",
                messageKey: "financialSubscriptionChargeMessage",
                params: { month: monthLabel, amount: subscriptionCharge.toFixed(2) },
              });
            } catch (notifyErr) {
              console.error("Subscription charge notification failed:", notifyErr);
            }
          }
        }

        const reservationsToLedger = await db
          .select()
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, member.id),
              eq(reservations.societyId, activeSociety.id),
              gte(reservations.startDate, startDate),
              lte(reservations.startDate, endDate),
              lte(reservations.startDate, now),
              ne(reservations.status, "cancelled"),
              sql`CAST(${reservations.totalAmount} AS DECIMAL) > 0`
            )
          );

        for (const resRow of reservationsToLedger) {
          const existsCharge = await movementExistsForReference(
            activeSociety.id,
            "reservation",
            resRow.id
          );
          if (existsCharge) continue;
          const amt = parseFloat(String(resRow.totalAmount ?? "0"));
          if (!Number.isFinite(amt) || amt <= 0) continue;
          const resStart = new Date(resRow.startDate);
          const chargeAt = new Date(
            resStart.getFullYear(),
            resStart.getMonth(),
            resStart.getDate(),
            23,
            59,
            59,
            999
          );
          const { inserted } = await maybePostReservationCharge({
            societyId: activeSociety.id,
            userId: member.id,
            reservationId: resRow.id,
            amount: amt,
            reservationName: resRow.name,
            createdAt: chargeAt,
          });
          if (inserted) {
            try {
              await notifyFinancialEvent({
                userId: member.id,
                societyId: activeSociety.id,
                referenceId: resRow.id,
                titleKey: "financialReservationChargeTitle",
                messageKey: "financialReservationChargeMessage",
                params: { name: resRow.name, amount: amt.toFixed(2) },
              });
            } catch (notifyErr) {
              console.error("Reservation charge notification failed:", notifyErr);
            }
          }
        }

        totalDebts += totalAmount;
        processedCount++;
      } catch (memberError) {
        console.error(`Error processing member ${member.name}:`, memberError);
      }
    }

    devLog(
      `Society ${activeSociety.id} totals for ${monthLabel}: ${totalDebts.toFixed(2)}€, members ${processedCount}/${members.length}`
    );
  }

  async calculateSubscriptionCharge(
    userId: string,
    societyId: string,
    year: number,
    month: number
  ): Promise<number> {
    try {
      const [userWithSubscription] = await db
        .select({
          subscriptionTypeId: users.subscriptionTypeId,
          subscriptionType: {
            id: subscriptionTypes.id,
            amount: subscriptionTypes.amount,
            period: subscriptionTypes.period,
            periodMonths: subscriptionTypes.periodMonths,
            isActive: subscriptionTypes.isActive,
          },
        })
        .from(users)
        .leftJoin(subscriptionTypes, eq(users.subscriptionTypeId, subscriptionTypes.id))
        .where(and(eq(users.id, userId), eq(users.societyId, societyId), eq(users.isActive, true)));

      if (!userWithSubscription?.subscriptionTypeId || !userWithSubscription?.subscriptionType) {
        return 0;
      }

      const subscription = userWithSubscription.subscriptionType;

      if (!subscription.isActive) {
        return 0;
      }

      const subscriptionAmount = Number(subscription.amount);
      const periodMonths = subscription.periodMonths || 12;

      if (subscription.period === "yearly" && month === 1) {
        devLog(`Adding yearly subscription charge for user ${userId}: €${subscriptionAmount}`);
        return subscriptionAmount;
      }

      if (subscription.period === "monthly") {
        devLog(
          `Adding monthly subscription charge for user ${userId}: €${subscriptionAmount}`
        );
        return subscriptionAmount;
      }

      if (subscription.period === "quarterly") {
        const quarterStartMonths = [1, 4, 7, 10];
        if (quarterStartMonths.includes(month)) {
          devLog(
            `Adding quarterly subscription charge for user ${userId}: €${subscriptionAmount}`
          );
          return subscriptionAmount;
        }
      }

      if (subscription.period === "custom") {
        if ((month - 1) % periodMonths === 0) {
          devLog(
            `Adding custom subscription charge for user ${userId}: €${subscriptionAmount}`
          );
          return subscriptionAmount;
        }
      }

      return 0;
    } catch (error) {
      console.error(`Error calculating subscription charge for user ${userId}:`, error);
      return 0;
    }
  }

  /** After consumptions / reservations: recalculate current month for the member's society only. */
  async calculateCurrentMonthDebtsForSociety(societyId: string): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    devLog(
      `[${now.toISOString()}] Real-time debt calculation for society ${societyId}: ${currentYear}-${String(currentMonth).padStart(2, "0")}`
    );

    try {
      await this.calculateMonthlyDebtsForSociety(societyId, currentYear, currentMonth);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Real-time debt calculation failed:`, error);
    }
  }

  /**
   * @deprecated Use calculateCurrentMonthDebtsForSociety(societyId) from HTTP handlers.
   */
  async calculateCurrentMonthDebts(): Promise<void> {
    const now = new Date();
    await this.calculateMonthlyDebtsAllSocieties(now.getFullYear(), now.getMonth() + 1);
  }

  startMonthlyCalculationCron(): void {
    const cronExpression = "0 2 1 * *";

    devLog(
      `[${new Date().toISOString()}] Starting monthly debt calculation cron job (schedule: ${cronExpression})`
    );

    cron.schedule(cronExpression, async () => {
      const now = new Date();
      const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      devLog(
        `[${now.toISOString()}] Scheduled debt calculation for previous month: ${previousYear}-${String(previousMonth).padStart(2, "0")}`
      );

      try {
        await this.calculateMonthlyDebtsAllSocieties(previousYear, previousMonth);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Scheduled debt calculation failed:`, error);
      }
    });

    if (process.env.NODE_ENV === "development") {
      setTimeout(async () => {
        const now = new Date();
        devLog(
          `[${now.toISOString()}] Dev: debt calculation for all societies, current month...`
        );
        try {
          await this.calculateMonthlyDebtsAllSocieties(now.getFullYear(), now.getMonth() + 1);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Test debt calculation failed:`, error);
        }
      }, 60000);
    }
  }

  async checkAndRunCatchupCalculation(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const previousMonthString = `${previousYear}-${String(previousMonth).padStart(2, "0")}`;

    devLog(
      `[${now.toISOString()}] Catch-up check for month ${previousMonthString} (all active societies)`
    );

    try {
      const active = await db
        .select({ id: societies.id })
        .from(societies)
        .where(eq(societies.isActive, true));

      for (const { id: societyId } of active) {
        const existingCalculation = await db
          .select({ id: credits.id })
          .from(credits)
          .where(
            and(
              eq(credits.societyId, societyId),
              eq(credits.month, previousMonthString),
              eq(credits.year, previousYear)
            )
          )
          .limit(1);

        if (existingCalculation.length === 0) {
          devLog(
            `[${now.toISOString()}] Catch-up: society ${societyId} missing ${previousMonthString}, calculating`
          );
          try {
            await this.calculateMonthlyDebtsForSociety(societyId, previousYear, previousMonth);
          } catch (err) {
            console.error(`Catch-up failed for society ${societyId}:`, err);
          }
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Catch-up debt calculation failed:`, error);
    }
  }

  stopCronJobs(): void {
    devLog(`[${new Date().toISOString()}] Stopping all cron jobs`);
    cron.getTasks().forEach(task => task.stop());
  }
}

export const debtCalculationService = DebtCalculationService.getInstance();
