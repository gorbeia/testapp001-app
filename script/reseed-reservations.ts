import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { reservations, societies, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  console.log('Reseeding reservations with correct event types...');

  // Get the active society
  const [society] = await db.select().from(societies).where(eq(societies.isActive, true)).limit(1);
  if (!society) {
    throw new Error('No active society found');
  }

  // Get the first user (admin)
  const [firstUser] = await db.select().from(users).limit(1);
  if (!firstUser) {
    throw new Error('No users found');
  }

  console.log('Using society ID:', society.id);
  console.log('Using user ID:', firstUser.id);

  // Delete existing reservations
  await db.delete(reservations);
  console.log('Deleted existing reservations');

  // Insert new reservations with correct event types
  const newReservations = [
    {
      id: '550e8400-e29b-4d69-a516-31095a414aa6',
      userId: firstUser.id,
      name: 'Urte Berria',
      type: 'bazkaria',
      status: 'pending',
      startDate: new Date('2025-12-25T18:00:00Z'),
      guests: 50,
      useKitchen: true,
      table: 'Mahaia 1',
      totalAmount: '250.00',
      notes: 'Janariak 25eko urte berria',
      societyId: society.id,
    },
    {
      id: '660f9b20-1a3c-4e7b-9f8d-2d3e8c9f5a1b',
      userId: firstUser.id,
      name: 'Bilera Familiarra',
      type: 'afaria',
      status: 'confirmed',
      startDate: new Date('2025-12-31T20:00:00Z'),
      guests: 20,
      useKitchen: false,
      table: 'Mahaia 2',
      totalAmount: '40.00',
      notes: 'Ezkontzeko familia biltzarra',
      societyId: society.id,
    },
    {
      id: '770b8c30-2d4d-4f8e-9c9e-3e4f9d0a6b2c',
      userId: firstUser.id,
      name: 'Bilera Enpresa',
      type: 'bazkaria',
      status: 'pending',
      startDate: new Date('2026-01-15T19:00:00Z'),
      guests: 100,
      useKitchen: true,
      table: 'Mahaia 3',
      totalAmount: '500.00',
      notes: 'Enpresako bilera ofiziala',
      societyId: society.id,
    },
    {
      id: '880c9d40-3e5e-4f9f-9d0f-4f5a0b7c8d3d',
      userId: firstUser.id,
      name: 'Batzarra',
      type: 'hamaiketakoa',
      status: 'confirmed',
      startDate: new Date('2025-12-20T12:00:00Z'),
      guests: 15,
      useKitchen: false,
      table: 'Mahaia 4',
      totalAmount: '30.00',
      notes: 'Batzar gaueko batzarra',
      societyId: society.id,
    }
  ];

  for (const reservation of newReservations) {
    await db.insert(reservations).values({
      ...reservation,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Added reservation: ${reservation.name} (${reservation.type})`);
  }

  console.log('Reservations reseeded successfully!');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
