import { db } from '../server/db';
import { credits } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function seedDemoDebts() {
  console.log('=== Seeding Demo Debts ===\n');

  try {
    // Demo debt data for testing and demonstration
    const demoDebts = [
      {
        memberId: '05312e3b-b893-4800-a154-e0ea49f40839', // Ane Zelaia
        societyId: 'b2cf15b6-6a42-42b9-afb9-1379482a32e7',
        month: '2025-11',
        year: 2025,
        monthNumber: 11,
        consumptionAmount: '45.50',
        reservationAmount: '120.00',
        kitchenAmount: '12.00',
        totalAmount: '177.50',
        status: 'pending',
        paidAmount: '0.00',
        memberName: 'Ane Zelaia'
      },
      {
        memberId: '57698777-1fd5-4236-abab-b32b59391e85', // Miren Urrutia
        societyId: 'b2cf15b6-6a42-42b9-afb9-1379482a32e7',
        month: '2025-11',
        year: 2025,
        monthNumber: 11,
        consumptionAmount: '89.25',
        reservationAmount: '50.00',
        kitchenAmount: '6.00',
        totalAmount: '145.25',
        status: 'pending',
        paidAmount: '0.00',
        memberName: 'Miren Urrutia'
      },
      {
        memberId: '3b736e92-6298-4c3a-8a4e-9da43482d582', // Mikel Etxeberria
        societyId: 'b2cf15b6-6a42-42b9-afb9-1379482a32e7',
        month: '2025-11',
        year: 2025,
        monthNumber: 11,
        consumptionAmount: '156.75',
        reservationAmount: '840.00',
        kitchenAmount: '18.00',
        totalAmount: '1014.75',
        status: 'pending',
        paidAmount: '0.00',
        memberName: 'Mikel Etxeberria'
      },
      {
        memberId: '7d66d4b8-345f-4193-a5ad-1fa8d7c3078e', // Jon Agirre
        societyId: 'b2cf15b6-6a42-42b9-afb9-1379482a32e7',
        month: '2025-11',
        year: 2025,
        monthNumber: 11,
        consumptionAmount: '32.00',
        reservationAmount: '0.00',
        kitchenAmount: '3.00',
        totalAmount: '35.00',
        status: 'pending',
        paidAmount: '0.00',
        memberName: 'Jon Agirre'
      },
      {
        memberId: 'b04163d6-783e-42e9-9232-b1316117d19a', // Andoni Garcia
        societyId: 'b2cf15b6-6a42-42b9-afb9-1379482a32e7',
        month: '2025-11',
        year: 2025,
        monthNumber: 11,
        consumptionAmount: '67.50',
        reservationAmount: '75.00',
        kitchenAmount: '9.00',
        totalAmount: '151.50',
        status: 'pending',
        paidAmount: '0.00',
        memberName: 'Andoni Garcia'
      }
    ];

    // Clear existing demo debts for November 2025
    console.log('Clearing existing November 2025 debts...');
    await db.delete(credits)
      .where(and(
        eq(credits.month, '2025-11'),
        eq(credits.year, 2025)
      ));

    // Insert demo debts
    console.log('Inserting demo debts for November 2025...');
    for (const debt of demoDebts) {
      await db.insert(credits).values({
        ...debt,
        calculatedAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  ✓ ${debt.memberName}: ${debt.totalAmount}€`);
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

// Import required functions
import { and } from 'drizzle-orm';

seedDemoDebts().then(() => {
  console.log('\nScript completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
