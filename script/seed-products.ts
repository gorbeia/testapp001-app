import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { products, societies } from '../shared/schema';
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

  console.log('Using society ID for products:', societyId);

  const demoProducts = [
    // Beverages
    {
      name: 'Kalea Garagardoa',
      description: 'Garagardo lokal ekoizpena, 330ml botila',
      category: 'edariak',
      price: '3.50',
      stock: '24',
      unit: 'unit',
      minStock: '6',
      supplier: 'Kalea Brewery',
      isActive: true,
    },
    {
      name: 'Txakoli Getariako',
      description: 'Txakoli zuria, 750ml botila',
      category: 'edariak',
      price: '12.00',
      stock: '12',
      unit: 'unit',
      minStock: '3',
      supplier: 'Local Winery',
      isActive: true,
    },
    {
      name: 'Ura Mineral',
      description: 'Ura minerala, 1.5L botila',
      category: 'edariak',
      price: '1.20',
      stock: '50',
      unit: 'unit',
      minStock: '10',
      supplier: 'Water Supplier',
      isActive: true,
    },
    
    // Food items
    {
      name: 'Pintxo Tortilla',
      description: 'Tortilla pintxoa',
      category: 'janariak',
      price: '2.50',
      stock: '20',
      unit: 'unit',
      minStock: '5',
      supplier: 'Kitchen',
      isActive: true,
    },
    {
      name: 'Gilda Pintxo',
      description: 'Gilda klasikoa: oliba, antxoa eta piperra',
      category: 'janariak',
      price: '3.00',
      stock: '15',
      unit: 'unit',
      minStock: '4',
      supplier: 'Kitchen',
      isActive: true,
    },
    {
      name: 'Txistorra Sandwich',
      description: 'Txistorra ogitartekoa',
      category: 'janariak',
      price: '5.50',
      stock: '10',
      unit: 'unit',
      minStock: '3',
      supplier: 'Kitchen',
      isActive: true,
    },
    
    // Snacks
    {
      name: 'Patata Frita',
      description: 'Patata frijituak, 150g poltsa',
      category: 'opilekuak',
      price: '2.00',
      stock: '30',
      unit: 'unit',
      minStock: '8',
      supplier: 'Snack Co',
      isActive: true,
    },
    {
      name: 'Oliba Berdea',
      description: 'Oliba berdeak, 200g potea',
      category: 'opilekuak',
      price: '4.50',
      stock: '18',
      unit: 'unit',
      minStock: '4',
      supplier: 'Local Producer',
      isActive: true,
    },
    
    // Coffee & Tea
    {
      name: 'Kafea',
      description: 'Espresso kafea',
      category: 'kafea',
      price: '1.80',
      stock: '100', // in servings
      unit: 'unit',
      minStock: '20',
      supplier: 'Coffee Roaster',
      isActive: true,
    },
    {
      name: 'Tila Belar',
      description: 'Tila belar tea, poltsa',
      category: 'kafea',
      price: '1.50',
      stock: '50',
      unit: 'unit',
      minStock: '10',
      supplier: 'Tea Supplier',
      isActive: true,
    },
    
    // Other items
    {
      name: 'Sukaldeko Gatzak',
      description: 'Gatz mahastua, 1kg',
      category: 'bestelakoak',
      price: '1.00',
      stock: '5',
      unit: 'kg',
      minStock: '1',
      supplier: 'Food Supplier',
      isActive: true,
    },
    {
      name: 'Azukrea',
      description: 'Azukre zuria, 1kg',
      category: 'bestelakoak',
      price: '2.00',
      stock: '8',
      unit: 'kg',
      minStock: '2',
      supplier: 'Food Supplier',
      isActive: true,
    },
  ];

  console.log('Seeding demo products...');

  for (const product of demoProducts) {
    await db.insert(products).values({
      ...product,
      societyId,
    });
  }

  console.log('Done.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
