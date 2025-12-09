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

  // Create some demo consumptions
  const demoConsumptions = [
    {
      userId: demoUsers[0].id,
      type: 'bar',
      status: 'closed',
      totalAmount: '15.50',
      notes: 'Ondo pasatako arratsaldea',
      closedAt: new Date(),
      closedBy: demoUsers[0].id,
    },
    {
      userId: demoUsers[1].id,
      type: 'bar',
      status: 'open',
      totalAmount: '8.00',
      notes: 'Kontsumo irekia',
    },
    {
      userId: demoUsers[2].id,
      type: 'event',
      status: 'closed',
      totalAmount: '42.75',
      notes: 'Urtebetetze festa',
      closedAt: new Date(),
      closedBy: demoUsers[0].id,
    },
  ];

  for (const consumptionData of demoConsumptions) {
    const [consumption] = await db.insert(consumptions).values({
      ...consumptionData,
      societyId,
    }).returning();
    
    // Add some consumption items for closed consumptions
    if (consumption.status === 'closed') {
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
  }

  console.log('Demo consumptions seeded successfully!');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
