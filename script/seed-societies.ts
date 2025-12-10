import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { societies } from '../shared/schema';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  console.log('Seeding societies...');

  // Check if societies already exist
  const existingSocieties = await db.select().from(societies);
  if (existingSocieties.length > 0) {
    console.log('Societies already exist, skipping seed.');
    await client.end();
    return;
  }

  const demoSocieties = [
    {
      name: 'Gure Txokoa',
      iban: 'ES91 2100 0418 4502 0005 1330',
      creditorId: 'ES45000B12345678',
      address: 'Kale Nagusia 15, 20001 Donostia',
      phone: '+34 943 111 222',
      email: 'info@guretxokoa.eus',
      reservationPricePerMember: '2.00',
      kitchenPricePerMember: '3.00',
      isActive: true,
    },
  ];

  for (const society of demoSocieties) {
    await db.insert(societies).values(society);
  }

  console.log('Done.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
