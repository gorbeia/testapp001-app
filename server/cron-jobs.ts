import cron from 'node-cron';
import { db } from './db';
import { eq, and, gte, ne, sql, notLike } from 'drizzle-orm';
import { users, consumptions, reservations, societies, credits } from '@shared/schema';

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

      // Get all members
      const members = await db.select().from(users).where(eq(users.societyId, activeSociety.id));
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

          // Calculate total amount
          const totalAmount = consumptionAmount + reservationAmount + kitchenAmount;

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
              totalAmount: totalAmount.toString(),
              status: 'pending'
            });
          }

          if (totalAmount > 0) {
            console.log(`Updated ${member.name}: ${totalAmount.toFixed(2)}€ (consumption: ${consumptionAmount.toFixed(2)}€, reservation: ${reservationAmount.toFixed(2)}€, kitchen: ${kitchenAmount.toFixed(2)}€)`);
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
