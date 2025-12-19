import cron from 'node-cron';
import { db } from './db';
import { eq, and, gte, ne, sql, notLike } from 'drizzle-orm';
import { users, consumptions, reservations, societies, credits, subscriptionTypes } from '@shared/schema';

class DebtCalculationService {
  private static instance: DebtCalculationService;
  private isRunning = false;

  private constructor() {}

  static getInstance(): DebtCalculationService {
    if (!DebtCalculationService.instance) {
      DebtCalculationService.instance = new DebtCalculationService();
    }
    return DebtCalculationService.instance;
  }

  async calculateMonthlyDebts(year: number, month: number): Promise<void> {
    if (this.isRunning) {
      console.log(`[${new Date().toISOString()}] Debt calculation already in progress, skipping...`);
      return;
    }

    this.isRunning = true;
    const monthString = month.toString().padStart(2, '0');
    const monthLabel = `${year}-${monthString}`;
    
    console.log(`[${new Date().toISOString()}] Starting debt calculation for ${monthLabel}...`);
    
    try {
      // Get active society
      const [activeSociety] = await db.select().from(societies).where(eq(societies.isActive, true));
      if (!activeSociety) {
        throw new Error('No active society found');
      }

      // Get all active members
      const members = await db.select().from(users).where(and(
        eq(users.societyId, activeSociety.id),
        eq(users.isActive, true)
      ));
      console.log(`Found ${members.length} members to process`);

      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      let totalDebts = 0;
      let processedCount = 0;

      for (const member of members) {
        try {
          // Calculate consumption amounts for the month
          const consumptionResults = await db
            .select({
              total: sql`SUM(CAST(${consumptions.totalAmount} AS DECIMAL))`.mapWith(Number)
            })
            .from(consumptions)
            .where(and(
              eq(consumptions.userId, member.id),
              eq(consumptions.societyId, activeSociety.id),
              gte(consumptions.createdAt, startDate),
              ne(consumptions.status, 'cancelled')
            ));

          const consumptionAmount = consumptionResults[0]?.total || 0;

          // Calculate reservation amounts for the month
          const reservationResults = await db
            .select({
              total: sql`SUM(CAST(${reservations.totalAmount} AS DECIMAL))`.mapWith(Number)
            })
            .from(reservations)
            .where(and(
              eq(reservations.userId, member.id),
              eq(reservations.societyId, activeSociety.id),
              gte(reservations.startDate, startDate),
              ne(reservations.status, 'cancelled')
            ));

          const reservationAmount = reservationResults[0]?.total || 0;

          // Calculate kitchen usage fees for reservations with kitchen
          const kitchenReservations = await db
            .select()
            .from(reservations)
            .where(and(
              eq(reservations.userId, member.id),
              eq(reservations.societyId, activeSociety.id),
              eq(reservations.useKitchen, true),
              gte(reservations.startDate, startDate),
              ne(reservations.status, 'cancelled')
            ));

          const kitchenAmount = kitchenReservations.length * Number(activeSociety.kitchenPricePerMember || 0);

          // Calculate subscription charges for the period
          const subscriptionAmount = await this.calculateSubscriptionCharge(member.id, activeSociety.id, year, month);

          // Calculate total amount
          const totalAmount = consumptionAmount + reservationAmount + kitchenAmount + subscriptionAmount;

          // Only process credits if member has actual debts
          if (totalAmount > 0) {
            // Check if credit already exists for this member and month
            const [existingCredit] = await db
              .select()
              .from(credits)
              .where(and(
                eq(credits.memberId, member.id),
                eq(credits.societyId, activeSociety.id),
                eq(credits.month, monthLabel)
              ));

            if (existingCredit) {
              // Update existing credit
              await db
                .update(credits)
                .set({
                  consumptionAmount: consumptionAmount.toString(),
                  reservationAmount: reservationAmount.toString(),
                  kitchenAmount: kitchenAmount.toString(),
                  subscriptionAmount: subscriptionAmount.toString(),
                  totalAmount: totalAmount.toString(),
                  updatedAt: new Date()
                })
                .where(eq(credits.id, existingCredit.id));
            } else {
              // Create new credit
              await db.insert(credits).values({
                memberId: member.id,
                societyId: activeSociety.id,
                month: monthLabel,
                year,
                monthNumber: month,
                consumptionAmount: consumptionAmount.toString(),
                reservationAmount: reservationAmount.toString(),
                kitchenAmount: kitchenAmount.toString(),
                subscriptionAmount: subscriptionAmount.toString(),
                totalAmount: totalAmount.toString(),
                status: 'pending'
              });
            }

            console.log(`Updated ${member.name}: ${totalAmount.toFixed(2)}€ (consumption: ${consumptionAmount.toFixed(2)}€, reservation: ${reservationAmount.toFixed(2)}€, kitchen: ${kitchenAmount.toFixed(2)}€, subscription: ${subscriptionAmount.toFixed(2)}€)`);
          }

          totalDebts += totalAmount;
          processedCount++;
        } catch (memberError) {
          console.error(`Error processing member ${member.name}:`, memberError);
        }
      }

      console.log(`[${new Date().toISOString()}] Debt calculation completed for ${monthLabel}:`);
      console.log(`- Total debts: ${totalDebts.toFixed(2)}€`);
      console.log(`- Members processed: ${processedCount}/${members.length}`);
      console.log(`- Calculation successful!`);

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error calculating debts for ${monthLabel}:`, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async calculateSubscriptionCharge(userId: string, societyId: string, year: number, month: number): Promise<number> {
    try {
      // Get user's subscription
      const [userWithSubscription] = await db
        .select({
          subscriptionTypeId: users.subscriptionTypeId,
          subscriptionType: {
            id: subscriptionTypes.id,
            amount: subscriptionTypes.amount,
            period: subscriptionTypes.period,
            periodMonths: subscriptionTypes.periodMonths,
            isActive: subscriptionTypes.isActive
          }
        })
        .from(users)
        .leftJoin(subscriptionTypes, eq(users.subscriptionTypeId, subscriptionTypes.id))
        .where(and(
          eq(users.id, userId),
          eq(users.societyId, societyId),
          eq(users.isActive, true)
        ));

      if (!userWithSubscription?.subscriptionTypeId || !userWithSubscription?.subscriptionType) {
        return 0; // No subscription
      }

      const subscription = userWithSubscription.subscriptionType;
      
      // Check if subscription is active
      if (!subscription.isActive) {
        return 0;
      }

      // Calculate if this is the start of a subscription period
      const subscriptionAmount = Number(subscription.amount);
      const periodMonths = subscription.periodMonths || 12; // Default to 12 months
      
      // For yearly subscriptions, check if this is January (month 1)
      if (subscription.period === 'yearly' && month === 1) {
        console.log(`Adding yearly subscription charge for user ${userId}: €${subscriptionAmount}`);
        return subscriptionAmount;
      }
      
      // For monthly subscriptions, charge every month
      if (subscription.period === 'monthly') {
        console.log(`Adding monthly subscription charge for user ${userId}: €${subscriptionAmount}`);
        return subscriptionAmount;
      }
      
      // For quarterly subscriptions, check if this is the start of a quarter
      if (subscription.period === 'quarterly') {
        const quarterStartMonths = [1, 4, 7, 10]; // Jan, Apr, Jul, Oct
        if (quarterStartMonths.includes(month)) {
          console.log(`Adding quarterly subscription charge for user ${userId}: €${subscriptionAmount}`);
          return subscriptionAmount;
        }
      }
      
      // For custom periods, calculate based on periodMonths
      if (subscription.period === 'custom') {
        // Assume subscription starts in January and recurs every periodMonths
        if ((month - 1) % periodMonths === 0) {
          console.log(`Adding custom subscription charge for user ${userId}: €${subscriptionAmount}`);
          return subscriptionAmount;
        }
      }
      
      return 0; // Not the start of a subscription period
    } catch (error) {
      console.error(`Error calculating subscription charge for user ${userId}:`, error);
      return 0;
    }
  }

  async calculateCurrentMonthDebts(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    console.log(`[${now.toISOString()}] Triggering real-time debt calculation for current month: ${currentYear}-${currentMonth.toString().padStart(2, '0')}`);
    
    try {
      await this.calculateMonthlyDebts(currentYear, currentMonth);
      console.log(`[${new Date().toISOString()}] Real-time debt calculation completed successfully`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Real-time debt calculation failed:`, error);
    }
  }

  startMonthlyCalculationCron(): void {
    // Run on the 1st of every month at 2:00 AM
    const cronExpression = '0 2 1 * *';
    
    console.log(`[${new Date().toISOString()}] Starting monthly debt calculation cron job (schedule: ${cronExpression})`);
    
    cron.schedule(cronExpression, async () => {
      const now = new Date();
      const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      
      console.log(`[${now.toISOString()}] Running scheduled debt calculation for previous month: ${previousYear}-${previousMonth.toString().padStart(2, '0')}`);
      
      try {
        await this.calculateMonthlyDebts(previousYear, previousMonth);
        console.log(`[${new Date().toISOString()}] Scheduled debt calculation completed successfully`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Scheduled debt calculation failed:`, error);
      }
    });

    // Also run a test calculation 1 minute after server starts (for development)
    if (process.env.NODE_ENV === 'development') {
      setTimeout(async () => {
        const now = new Date();
        console.log(`[${now.toISOString()}] Running test debt calculation for current month...`);
        try {
          await this.calculateMonthlyDebts(now.getFullYear(), now.getMonth() + 1);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Test debt calculation failed:`, error);
        }
      }, 60000); // 1 minute after start
    }
  }

  async checkAndRunCatchupCalculation(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Check previous month (since current month is still open)
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    const previousMonthString = `${previousYear}-${previousMonth.toString().padStart(2, '0')}`;
    
    console.log(`[${now.toISOString()}] Checking for catch-up debt calculation for month: ${previousMonthString}`);
    
    try {
      // Check if previous month's calculation exists
      const existingCalculation = await db.select()
        .from(credits)
        .where(and(
          eq(credits.month, previousMonthString),
          eq(credits.year, previousYear)
        ))
        .limit(1);
      
      if (existingCalculation.length === 0) {
        console.log(`[${now.toISOString()}] No debt calculation found for ${previousMonthString}, running catch-up calculation`);
        await this.calculateMonthlyDebts(previousYear, previousMonth);
        console.log(`[${now.toISOString()}] Catch-up debt calculation completed for ${previousMonthString}`);
      } else {
        console.log(`[${now.toISOString()}] Debt calculation already exists for ${previousMonthString}, skipping catch-up`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Catch-up debt calculation failed:`, error);
    }
  }

  stopCronJobs(): void {
    console.log(`[${new Date().toISOString()}] Stopping all cron jobs`);
    cron.getTasks().forEach(task => task.stop());
  }
}

export const debtCalculationService = DebtCalculationService.getInstance();
