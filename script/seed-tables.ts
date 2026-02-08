import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { tables } from "../shared/schema";
import "dotenv/config";

async function seedTables() {
  console.log("Seeding tables...");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const db = drizzle(client);

  try {
    // Check if tables already exist
    const existingTables = await db.select().from(tables).limit(1);

    if (existingTables.length > 0) {
      console.log("Tables already exist, skipping seed");
      return;
    }

    // Sample tables with different capacities and descriptions
    const sampleTables = [
      {
        name: "Mahaia 1",
        minCapacity: 2,
        maxCapacity: 4,
        description: "Barrutik dagoen mahaia, bikoteentzat aproposa",
        isActive: true,
      },
      {
        name: "Mahaia 2",
        minCapacity: 2,
        maxCapacity: 4,
        description: "Barrutik dagoen beste mahaia",
        isActive: true,
      },
      {
        name: "Mahaia 3",
        minCapacity: 4,
        maxCapacity: 6,
        description: "Talde txikientzako mahaia, barrutik kokatua",
        isActive: true,
      },
      {
        name: "Mahaia 4",
        minCapacity: 4,
        maxCapacity: 8,
        description: "Terrazan dagoen mahaia, egun egunerako perfektua",
        isActive: true,
      },
      {
        name: "Mahaia 5",
        minCapacity: 6,
        maxCapacity: 10,
        description: "Terrazako mahaia handiena, talde handientzat",
        isActive: true,
      },
      {
        name: "Gela Pribatua",
        minCapacity: 8,
        maxCapacity: 15,
        description: "Gela pribatua, ekitaldi berezi eta bilera pertsonalentzat",
        isActive: true,
      },
    ];

    await db.insert(tables).values(sampleTables);
    console.log("Tables seeded successfully!");
  } catch (error) {
    console.error("Error seeding tables:", error);
  } finally {
    await client.end();
  }
}

seedTables();
