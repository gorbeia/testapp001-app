import 'dotenv/config';
import { db } from '../server/db';
import { credits, users, societies } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function seedDemoDebts() {
  console.log('=== Seeding Demo Debts ===\n');

  try {
    // Get the active society
    const activeSociety = await db.select().from(societies).where(eq(societies.isActive, true)).limit(1);
    if (activeSociety.length === 0) {
      console.log('No active society found, skipping demo debts seeding');
      return;
    }
    
    const societyId = activeSociety[0].id;
    console.log('Using society ID for demo debts:', societyId);

    // Get all users for the society
    const societyUsers = await db.select().from(users).where(eq(users.societyId, societyId));
    if (societyUsers.length === 0) {
      console.log('No users found for society, skipping demo debts seeding');
      return;
    }

    console.log(`Found ${societyUsers.length} users for demo debts`);

    // Clear existing demo debts for November 2025
    console.log('Clearing existing November 2025 debts...');
    await db.delete(credits)
      .where(eq(credits.month, '2025-11'));

    // Create demo debts for each user with different amounts
    const demoDebts = societyUsers.map((user, index) => {
      const baseAmount = 50 + (index * 25); // Different amounts for each user
      const reservationAmount = (baseAmount * 0.6).toFixed(2);
      const consumptionAmount = (baseAmount * 0.3).toFixed(2);
      const kitchenAmount = (baseAmount * 0.1).toFixed(2);
      const totalAmount = (parseFloat(reservationAmount) + parseFloat(consumptionAmount) + parseFloat(kitchenAmount)).toFixed(2);

      return {
        memberId: user.id,
        societyId,
        month: '2025-11',
        year: 2025,
        monthNumber: 11,
        consumptionAmount,
        reservationAmount,
        kitchenAmount,
        totalAmount,
        status: 'pending' as const,
        paidAmount: '0.00',
      };
    });

    // Insert demo debts
    console.log('Inserting demo debts for November 2025...');
    for (const debt of demoDebts) {
      await db.insert(credits).values({
        ...debt,
        calculatedAt: new Date(),
        updatedAt: new Date()
      });
      const user = societyUsers.find(u => u.id === debt.memberId);
      console.log(`  ✓ ${user?.name || user?.username}: ${debt.totalAmount}€`);
    }

    console.log('\n=== Demo Debts Seeded Successfully ===');
    console.log(`Total debts seeded: ${demoDebts.length}`);
    console.log('Month: November 2025');
    
    // Calculate total
    const totalDebt = demoDebts.reduce((sum, debt) => sum + parseFloat(debt.totalAmount), 0);
    console.log(`Total amount: ${totalDebt.toFixed(2)}€`);

  } catch (error) {
    console.error('Error seeding demo debts:', error);
    process.exit(1);
  }
}

seedDemoDebts().then(() => {
  console.log('\nScript completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
