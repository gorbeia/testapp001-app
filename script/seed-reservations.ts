import { db } from '../server/db';
import { reservations, societies, type Reservation } from '../shared/schema';
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

    const dummyReservations: Omit<Reservation, 'createdAt' | 'updatedAt'>[] = [
      {
        id: '550e8400-e29b-4d69-a516-31095a414aa6',
        userId: 'c7829a2b-4f96-413f-86b5-8f08fbb98f30',
        name: 'Urte Berria',
        description: 'Urte berriko ekitaldia',
        type: 'event',
        status: 'pending',
        startDate: new Date('2025-12-25T18:00:00Z'),
        expectedGuests: 50,
        totalAmount: '250.00',
        notes: 'Janariak 25eko urte berria',
        societyId,
      },
      {
        id: '660f9b20-1a3c-4e7b-9f8d-2d3e8c9f5a1b',
        userId: 'c7829a2b-4f96-413f-86b5-8f08fbb98f30',
        name: 'Bilera Familiarra',
        description: 'Familientzatko biltzarketa',
        type: 'private',
        status: 'confirmed',
        startDate: new Date('2025-12-31T20:00:00Z'),
        expectedGuests: 20,
        totalAmount: '150.00',
        notes: 'Ezkonteko familia biltzarra',
        societyId,
      },
      {
        id: '770b8c30-2d4d-4f8e-9c9e-3e4f9d0a6b2c',
        userId: 'c7829a2b-4f96-413f-86b5-8f08fbb98f30',
        name: 'Bilera Enpresa',
        description: 'Enpresako bilera',
        type: 'event',
        status: 'pending',
        startDate: new Date('2026-01-15T19:00:00Z'),
        expectedGuests: 100,
        totalAmount: '500.00',
        notes: 'Enpresako bilera ofiziala',
        societyId,
      },
      {
        id: '880c9d40-3e5e-4f9f-9d0f-4f5a0b7c8d3d',
        userId: 'c7829a2b-4f96-413f-86b5-8f08fbb98f30',
        name: 'Batzarra',
        description: 'Batzar gaueko',
        type: 'meeting',
        status: 'confirmed',
        startDate: new Date('2025-12-20T12:00:00Z'),
        expectedGuests: 15,
        totalAmount: '75.00',
        notes: 'Batzar gaueko batzarra',
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
      
      // Insert new reservation
      const newReservation = {
        ...reservation,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await db.insert(reservations).values(newReservation);
      console.log(`Added reservation: ${reservation.name}`);
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
