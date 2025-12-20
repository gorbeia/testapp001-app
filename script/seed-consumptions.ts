import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { consumptions, consumptionItems, users, products, societies } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  // Get the active society or the first one
  let societyId = '';
  const activeSociety = await db.select().from(societies).where(eq(societies.isActive, true)).limit(1);
  if (activeSociety.length === 0) {
    const firstSociety = await db.select().from(societies).limit(1);
    if (firstSociety.length === 0) {
      throw new Error('No societies found in database');
    }
    societyId = firstSociety[0].id;
  } else {
    societyId = activeSociety[0].id;
  }

  console.log('Using society ID for consumptions:', societyId);

  console.log('Seeding demo consumptions...');

  // Get demo users and products
  const demoUsers = await db.select().from(users).limit(3);
  const demoProducts = await db.select().from(products).limit(5);

  if (demoUsers.length === 0 || demoProducts.length === 0) {
    console.log('No users or products found. Please run seed-users and seed-products first.');
    await client.end();
    return;
  }

  // Create some demo consumptions with November 2025 dates
  const novemberDates = [
    new Date(2025, 10, 5),   // November 5, 2025
    new Date(2025, 10, 12),  // November 12, 2025  
    new Date(2025, 10, 18),  // November 18, 2025
    new Date(2025, 10, 25),  // November 25, 2025
    new Date(2025, 10, 28),  // November 28, 2025
  ];

  const demoConsumptions = [
    {
      userId: demoUsers[0].id,
      totalAmount: '15.50',
      notes: 'Ondo pasatako arratsaldea',
      createdAt: novemberDates[0],
      closedAt: novemberDates[0],
      closedBy: demoUsers[0].id,
    },
    {
      userId: demoUsers[1].id,
      totalAmount: '8.00',
      notes: 'Kontsumo irekia',
      createdAt: novemberDates[1],
    },
    {
      userId: demoUsers[2].id,
      totalAmount: '42.75',
      notes: 'Urtebetetze festa',
      createdAt: novemberDates[2],
      closedAt: novemberDates[2],
      closedBy: demoUsers[0].id,
    },
    {
      userId: demoUsers[0].id,
      totalAmount: '12.25',
      notes: 'Asteguneko kontsumoa',
      createdAt: novemberDates[3],
    },
    {
      userId: demoUsers[1].id,
      totalAmount: '6.50',
      notes: 'Azken kontsumoa',
      createdAt: novemberDates[4],
      closedAt: novemberDates[4],
      closedBy: demoUsers[1].id,
    },
  ];

  for (const consumptionData of demoConsumptions) {
    const [consumption] = await db.insert(consumptions).values({
      ...consumptionData,
      societyId,
    }).returning();
    
    // Add some consumption items for all consumptions
    const itemsToAdd = Math.floor(Math.random() * 3) + 1; // 1-3 items
    
    for (let i = 0; i < itemsToAdd && i < demoProducts.length; i++) {
        const product = demoProducts[i];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 units
        const unitPrice = parseFloat(product.price);
        const totalPrice = unitPrice * quantity;
        
        await db.insert(consumptionItems).values({
          consumptionId: consumption.id,
          productId: product.id,
          quantity,
          unitPrice: unitPrice.toString(),
          totalPrice: totalPrice.toString(),
          notes: `Demo kontsumo item ${i + 1}`,
        });
      }
    }

  console.log('Demo consumptions seeded successfully!');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
