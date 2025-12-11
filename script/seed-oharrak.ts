import { db } from '../server/db';
import { oharrak, societies, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function seedOharrak() {
  console.log('Seeding oharrak (notes)...');

  try {
    // Get the first society and admin user for seeding
    const [society] = await db.select().from(societies).limit(1);
    if (!society) {
      throw new Error('No society found. Please seed societies first.');
    }

    const [adminUser] = await db.select().from(users)
      .where(and(
        eq(users.role, 'bazkidea'),
        eq(users.function, 'administratzailea')
      ))
      .limit(1);
    if (!adminUser) {
      throw new Error('No admin user found. Please seed users first.');
    }

    // Sample notes in Basque
    const sampleNotes = [
      {
        title: 'Ondo etorri!',
        content: 'Txokora ongi etorri! Hemen zure kontsumoak eta erreserbak kudea ditzakezu.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Gogoratu: Kontsumoak itxi',
        content: 'Mesedez, gogoratu kontsumoak hilaren amaieran ixtea. Horrela zorrak ondo kalkulatuko dira.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Produktu berriak eskuragarri',
        content: 'Gaur produktu berriak gehitu dira: sagardo naturala eta gazta artzain berria. Probatu!',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Sistemaren mantenua',
        content: 'Asteazkenetan 22:00-23:00 artean sistemaren mantenua egingo da. Une horretan zerbitzua ezin da erabiliko.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Erreserbak egiteko modua',
        content: 'Erreserbak egiteko, joan "Erreserbak" atalera eta aukeratu data eta lagun kopurua. Kontuan hartu sukaldaritza prezioa pertsonako.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Ordainketa metodoak',
        content: 'Ordainketa guztiak banku-transferentziaz egin behar dira. Kontuko zenbakia: ESXX XXXX XXXX XXXX XXXX.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Laguntza teknikoa',
        content: 'Arazo teknikorik baduzu, jarri harremanetan administratzailearekin: admin@txokoa.eus edo 612 345 678.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      },
      {
        title: 'Hilabeteko bilera',
        content: 'Hilabeteko bilera ostegunean 19:00etan izango da. Txokoko egoeraz eta kontuak eztabaidatzeko.',
        isActive: true,
        createdBy: adminUser.id,
        societyId: society.id,
      }
    ];

    // Check if notes already exist
    const existingNotes = await db.select().from(oharrak)
      .where(eq(oharrak.societyId, society.id));
    if (existingNotes.length > 0) {
      console.log(`Found ${existingNotes.length} existing notes. Skipping seeding.`);
      return;
    }

    // Insert notes
    const insertedNotes = await db.insert(oharrak).values(sampleNotes).returning();
    console.log(`Successfully seeded ${insertedNotes.length} notes`);

  } catch (error) {
    console.error('Error seeding oharrak:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOharrak()
    .then(() => {
      console.log('Oharrak seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Oharrak seeding failed:', error);
      process.exit(1);
    });
}

export { seedOharrak };
