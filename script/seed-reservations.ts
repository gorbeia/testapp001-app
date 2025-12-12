import { db } from '../server/db';
import { reservations, societies, users, tables, type Reservation } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function seedReservations() {
  try {
    console.log('Seeding reservations...');
    
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

    console.log('Using society ID for reservations:', societyId);

    // Get the first user (admin) for reservations
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
      throw new Error('No users found in database');
    }
    
    console.log('Using user ID for reservations:', firstUser.id);

    // Get all active tables
    const activeTables = await db.select().from(tables).where(eq(tables.isActive, true));
    if (activeTables.length === 0) {
      console.log('No active tables found, skipping reservation seeding');
      return;
    }
    
    console.log('Found active tables:', activeTables.map(t => t.name));

    const dummyReservations: Omit<Reservation, 'createdAt' | 'updatedAt'>[] = [
      {
        id: '550e8400-e29b-4d69-a516-31095a414aa6',
        userId: firstUser.id,
        name: 'Urte Berria',
        type: 'bazkaria',
        status: 'confirmed',
        startDate: new Date('2025-12-25T18:00:00Z'),
        guests: 15, // Adjusted for Gela Pribatua capacity
        useKitchen: true,
        table: 'Gela Pribatua', // Using actual table name
        totalAmount: '375.00', // 15 * 25 (reservation) + 15 * 10 (kitchen)
        notes: 'Janariak 25eko urte berria',
        societyId,
      },
      {
        id: '660f9b20-1a3c-4e7b-9f8d-2d3e8c9f5a1b',
        userId: firstUser.id,
        name: 'Bilera Familiarra',
        type: 'afaria',
        status: 'confirmed',
        startDate: new Date('2025-12-31T20:00:00Z'),
        guests: 8, // Adjusted for Mahaia 5 capacity
        useKitchen: false,
        table: 'Mahaia 5', // Using actual table name
        totalAmount: '200.00', // 8 * 25
        notes: 'Ezkontzeko familia biltzarra',
        societyId,
      },
      {
        id: '770b8c30-2d4d-4f8e-9c9e-3e4f9d0a6b2c',
        userId: firstUser.id,
        name: 'Bilera Enpresa',
        type: 'bazkaria',
        status: 'confirmed',
        startDate: new Date('2026-01-15T19:00:00Z'),
        guests: 6, // Adjusted for Mahaia 4 capacity
        useKitchen: true,
        table: 'Mahaia 4', // Using actual table name
        totalAmount: '210.00', // 6 * 25 + 6 * 10
        notes: 'Enpresako bilera ofiziala',
        societyId,
      },
      {
        id: '880c9d40-3e5e-4f9f-9d0f-4f5a0b7c8d3d',
        userId: firstUser.id,
        name: 'Batzarra',
        type: 'hamaiketakoa',
        status: 'confirmed',
        startDate: new Date('2025-12-20T12:00:00Z'),
        guests: 4, // Adjusted for Mahaia 3 capacity
        useKitchen: false,
        table: 'Mahaia 3', // Using actual table name
        totalAmount: '100.00', // 4 * 25
        notes: 'Batzar gaueko batzarra',
        societyId,
      },
      {
        id: '990d0e50-4f6f-5g0g-0e1g-5g6b1c8d9e4e',
        userId: firstUser.id,
        name: 'Ondo Pasatzeko',
        type: 'bazkaria',
        status: 'confirmed',
        startDate: new Date('2025-12-15T19:00:00Z'),
        guests: 3, // Adjusted for Mahaia 1 capacity
        useKitchen: false,
        table: 'Mahaia 1', // Using actual table name
        totalAmount: '75.00', // 3 * 25
        notes: 'Lagun arteko bazkaria',
        societyId,
      },
      {
        id: '110e1f60-5g7g-6h1h-1f2h-6h7c2d9e0f5f',
        userId: firstUser.id,
        name: 'Eguberriko Afaria',
        type: 'afaria',
        status: 'pending',
        startDate: new Date('2025-12-24T21:00:00Z'),
        guests: 2, // Adjusted for Mahaia 2 capacity
        useKitchen: false,
        table: 'Mahaia 2', // Using actual table name
        totalAmount: '50.00', // 2 * 25
        notes: 'Eguberriko afaria familiarra',
        societyId,
      }
    ];
    
    for (const reservation of dummyReservations) {
      // Check if reservation already exists (idempotent)
      const existing = await db.select()
        .from(reservations)
        .where(eq(reservations.id, reservation.id))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`Reservation already exists: ${reservation.name} (skipping)`);
        continue;
      }
      
      // Verify that the table exists and is active
      const tableExists = activeTables.some(table => table.name === reservation.table);
      if (!tableExists) {
        console.log(`Table '${reservation.table}' not found or inactive for reservation '${reservation.name}' (skipping)`);
        continue;
      }
      
      // Verify guest count is within table capacity
      const table = activeTables.find(t => t.name === reservation.table);
      if (table && reservation.guests !== null && (reservation.guests < (table.minCapacity ?? 1) || reservation.guests > table.maxCapacity)) {
        console.log(`Guest count ${reservation.guests} not suitable for table '${reservation.table}' (capacity: ${table.minCapacity ?? 1}-${table.maxCapacity}) for reservation '${reservation.name}' (skipping)`);
        continue;
      }
      
      // Insert new reservation
      const newReservation = {
        ...reservation,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await db.insert(reservations).values(newReservation);
      console.log(`Added reservation: ${reservation.name} at ${reservation.table} for ${reservation.guests} guests`);
    }
    
    console.log('Reservations seeded successfully!');
  } catch (error) {
    console.error('Error seeding reservations:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedReservations()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
