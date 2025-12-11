import { db } from '../server/db';
import { eq, and } from 'drizzle-orm';
import { users, consumptions, consumptionItems, reservations, societies, products, credits } from '../shared/schema';

async function seedHistoricalData() {
  console.log('Seeding historical data for November and October 2025...');
  
  // First, seed precalculated demo debts
  console.log('Seeding precalculated demo debts...');
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

  // Get active society
  const [activeSociety] = await db.select().from(societies).where(eq(societies.isActive, true));
  if (!activeSociety) {
    throw new Error('No active society found');
  }

  // Get all members
  const members = await db.select().from(users).where(eq(users.societyId, activeSociety.id));
  console.log(`Found ${members.length} members`);

  // Get available products
  const availableProducts = await db.select().from(products).where(eq(products.societyId, activeSociety.id));
  console.log(`Found ${availableProducts.length} products`);

  // Helper function to create date for specific month
  const createDate = (year: number, month: number, day: number, hour: number = 12) => {
    return new Date(year, month - 1, day, hour, 0, 0);
  };

  // Helper function to add consumption items
  const addConsumptionItems = async (consumptionId: string, items: Array<{productId: string, quantity: number, unitPrice: string}>) => {
    for (const item of items) {
      const totalPrice = (parseFloat(item.unitPrice) * item.quantity).toFixed(2);
      await db.insert(consumptionItems).values({
        consumptionId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: totalPrice,
      });
    }
  };

  // Seed November 2025 data
  console.log('\n=== Seeding November 2025 Data ===');
  
  // November consumptions
  const novemberConsumptions = [
    {
      userId: members[0]?.id, // Mikel Etxeberria
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '45.50',
      notes: 'November bar consumption',
      createdAt: createDate(2025, 11, 5),
      closedAt: createDate(2025, 11, 5),
      closedBy: members[0]?.id,
    },
    {
      userId: members[0]?.id,
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '32.00',
      notes: 'November bar consumption',
      createdAt: createDate(2025, 11, 15),
      closedAt: createDate(2025, 11, 15),
      closedBy: members[0]?.id,
    },
    {
      userId: members[1]?.id, // Ane Zelaia
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '28.75',
      notes: 'November bar consumption',
      createdAt: createDate(2025, 11, 8),
      closedAt: createDate(2025, 11, 8),
      closedBy: members[1]?.id,
    },
    {
      userId: members[2]?.id, // Miren Urrutia
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '67.25',
      notes: 'November bar consumption',
      createdAt: createDate(2025, 11, 12),
      closedAt: createDate(2025, 11, 12),
      closedBy: members[2]?.id,
    },
    {
      userId: members[8]?.id, // Jon Agirre
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '41.50',
      notes: 'November bar consumption',
      createdAt: createDate(2025, 11, 20),
      closedAt: createDate(2025, 11, 20),
      closedBy: members[8]?.id,
    },
  ];

  // Insert November consumptions with items
  for (const consumption of novemberConsumptions) {
    if (consumption.userId) {
      // Insert consumption session
      const [newConsumption] = await db.insert(consumptions).values(consumption).returning();
      
      // Add consumption items based on total amount
      if (consumption.totalAmount === '45.50') {
        await addConsumptionItems(newConsumption.id, [
          { productId: availableProducts[0]?.id || 'default-product', quantity: 2, unitPrice: '3.50' }, // 2x3.50 = 7.00
          { productId: availableProducts[1]?.id || 'default-product', quantity: 3, unitPrice: '4.50' }, // 3x4.50 = 13.50
          { productId: availableProducts[2]?.id || 'default-product', quantity: 5, unitPrice: '5.00' }, // 5x5.00 = 25.00
        ]);
      } else if (consumption.totalAmount === '32.00') {
        await addConsumptionItems(newConsumption.id, [
          { productId: availableProducts[0]?.id || 'default-product', quantity: 4, unitPrice: '3.50' }, // 4x3.50 = 14.00
          { productId: availableProducts[2]?.id || 'default-product', quantity: 3, unitPrice: '6.00' }, // 3x6.00 = 18.00
        ]);
      } else if (consumption.totalAmount === '28.75') {
        await addConsumptionItems(newConsumption.id, [
          { productId: availableProducts[1]?.id || 'default-product', quantity: 2, unitPrice: '4.50' }, // 2x4.50 = 9.00
          { productId: availableProducts[2]?.id || 'default-product', quantity: 2, unitPrice: '5.00' }, // 2x5.00 = 10.00
          { productId: availableProducts[3]?.id || 'default-product', quantity: 1, unitPrice: '9.75' }, // 1x9.75 = 9.75
        ]);
      } else if (consumption.totalAmount === '67.25') {
        await addConsumptionItems(newConsumption.id, [
          { productId: availableProducts[0]?.id || 'default-product', quantity: 5, unitPrice: '3.50' }, // 5x3.50 = 17.50
          { productId: availableProducts[1]?.id || 'default-product', quantity: 4, unitPrice: '4.50' }, // 4x4.50 = 18.00
          { productId: availableProducts[2]?.id || 'default-product', quantity: 6, unitPrice: '5.00' }, // 6x5.00 = 30.00
          { productId: availableProducts[3]?.id || 'default-product', quantity: 1, unitPrice: '1.75' }, // 1x1.75 = 1.75
        ]);
      } else if (consumption.totalAmount === '41.50') {
        await addConsumptionItems(newConsumption.id, [
          { productId: availableProducts[1]?.id || 'default-product', quantity: 3, unitPrice: '4.50' }, // 3x4.50 = 13.50
          { productId: availableProducts[2]?.id || 'default-product', quantity: 4, unitPrice: '5.00' }, // 4x5.00 = 20.00
          { productId: availableProducts[3]?.id || 'default-product', quantity: 1, unitPrice: '8.00' }, // 1x8.00 = 8.00
        ]);
      }
      
      console.log(`Added November consumption for ${consumption.totalAmount}€ with items`);
    }
  }

  // November reservations
  const novemberReservations = [
    {
      userId: members[0]?.id,
      societyId: activeSociety.id,
      name: 'November Birthday Party',
      type: 'event',
      status: 'completed',
      startDate: createDate(2025, 11, 10, 19),
      guests: 15,
      useKitchen: true,
      totalAmount: '150.00',
      notes: 'Birthday celebration with kitchen',
      table: 'Mahaia 1',
      createdAt: createDate(2025, 11, 1),
    },
    {
      userId: members[2]?.id,
      societyId: activeSociety.id,
      name: 'November Meeting',
      type: 'meeting',
      status: 'completed',
      startDate: createDate(2025, 11, 18, 20),
      guests: 8,
      useKitchen: false,
      totalAmount: '40.00',
      notes: 'Regular meeting',
      table: 'Mahaia 2',
      createdAt: createDate(2025, 11, 5),
    },
    {
      userId: members[1]?.id,
      societyId: activeSociety.id,
      name: 'November Dinner',
      type: 'event',
      status: 'completed',
      startDate: createDate(2025, 11, 25, 21),
      guests: 6,
      useKitchen: true,
      totalAmount: '60.00',
      notes: 'Dinner with kitchen use',
      table: 'Mahaia 3',
      createdAt: createDate(2025, 11, 10),
    },
  ];

  // Insert November reservations
  for (const reservation of novemberReservations) {
    if (reservation.userId) {
      await db.insert(reservations).values(reservation);
      console.log(`Added November reservation for ${reservation.totalAmount}€`);
    }
  }

  // Seed October 2025 data
  console.log('\n=== Seeding October 2025 Data ===');
  
  // October consumptions
  const octoberConsumptions = [
    {
      userId: members[0]?.id,
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '38.00',
      notes: 'October bar consumption',
      createdAt: createDate(2025, 10, 3),
      closedAt: createDate(2025, 10, 3),
      closedBy: members[0]?.id,
    },
    {
      userId: members[0]?.id,
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '25.50',
      notes: 'October bar consumption',
      createdAt: createDate(2025, 10, 18),
      closedAt: createDate(2025, 10, 18),
      closedBy: members[0]?.id,
    },
    {
      userId: members[1]?.id,
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '19.25',
      notes: 'October bar consumption',
      createdAt: createDate(2025, 10, 7),
      closedAt: createDate(2025, 10, 7),
      closedBy: members[1]?.id,
    },
    {
      userId: members[2]?.id,
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '52.75',
      notes: 'October bar consumption',
      createdAt: createDate(2025, 10, 14),
      closedAt: createDate(2025, 10, 14),
      closedBy: members[2]?.id,
    },
    {
      userId: members[8]?.id,
      societyId: activeSociety.id,
      type: 'bar',
      status: 'closed',
      totalAmount: '31.00',
      notes: 'October bar consumption',
      createdAt: createDate(2025, 10, 22),
      closedAt: createDate(2025, 10, 22),
      closedBy: members[8]?.id,
    },
  ];

  // Insert October consumptions
  for (const consumption of octoberConsumptions) {
    if (consumption.userId) {
      await db.insert(consumptions).values(consumption);
      console.log(`Added October consumption for ${consumption.totalAmount}€`);
    }
  }

  // October reservations
  const octoberReservations = [
    {
      userId: members[0]?.id,
      societyId: activeSociety.id,
      name: 'October Festival',
      type: 'event',
      status: 'completed',
      startDate: createDate(2025, 10, 12, 18),
      guests: 20,
      useKitchen: true,
      totalAmount: '200.00',
      notes: 'Annual festival with kitchen',
      table: 'Mahaia 1',
      createdAt: createDate(2025, 10, 1),
    },
    {
      userId: members[2]?.id,
      societyId: activeSociety.id,
      name: 'October Workshop',
      type: 'meeting',
      status: 'completed',
      startDate: createDate(2025, 10, 20, 16),
      guests: 10,
      useKitchen: false,
      totalAmount: '50.00',
      notes: 'Workshop session',
      table: 'Mahaia 2',
      createdAt: createDate(2025, 10, 5),
    },
    {
      userId: members[1]?.id,
      societyId: activeSociety.id,
      name: 'October Lunch',
      type: 'event',
      status: 'completed',
      startDate: createDate(2025, 10, 28, 13),
      guests: 4,
      useKitchen: true,
      totalAmount: '40.00',
      notes: 'Weekend lunch',
      table: 'Mahaia 3',
      createdAt: createDate(2025, 10, 10),
    },
  ];

  // Insert October reservations
  for (const reservation of octoberReservations) {
    if (reservation.userId) {
      await db.insert(reservations).values(reservation);
      console.log(`Added October reservation for ${reservation.totalAmount}€`);
    }
  }

  console.log('\n=== Summary ===');
  console.log('Demo Debts (November 2025):');
  console.log(`- ${demoDebts.length} members with precalculated debts totaling ${demoDebts.reduce((sum, d) => sum + parseFloat(d.totalAmount), 0).toFixed(2)}€`);
  
  console.log('\nNovember 2025:');
  console.log(`- ${novemberConsumptions.length} consumptions totaling ${novemberConsumptions.reduce((sum, c) => sum + parseFloat(c.totalAmount), 0).toFixed(2)}€`);
  console.log(`- ${novemberReservations.length} reservations totaling ${novemberReservations.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0).toFixed(2)}€`);
  
  console.log('\nOctober 2025:');
  console.log(`- ${octoberConsumptions.length} consumptions totaling ${octoberConsumptions.reduce((sum, c) => sum + parseFloat(c.totalAmount), 0).toFixed(2)}€`);
  console.log(`- ${octoberReservations.length} reservations totaling ${octoberReservations.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0).toFixed(2)}€`);
  
  console.log('\nHistorical data and demo debts seeded successfully!');
}

seedHistoricalData().catch(console.error);
