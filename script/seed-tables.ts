import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { eq } from "drizzle-orm";
import { societies, tables } from "../shared/schema";
import "dotenv/config";

async function seedTables() {
  console.log("Seeding tables...");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const db = drizzle(client);

  try {
    let societyId = "";
    const activeSociety = await db
      .select()
      .from(societies)
      .where(eq(societies.isActive, true))
      .limit(1);
    if (activeSociety.length === 0) {
      const firstSociety = await db.select().from(societies).limit(1);
      if (firstSociety.length === 0) {
        console.log("No societies found, skipping table seed");
        return;
      }
      societyId = firstSociety[0].id;
    } else {
      societyId = activeSociety[0].id;
    }

    const existingForSociety = await db
      .select()
      .from(tables)
      .where(eq(tables.societyId, societyId))
      .limit(1);

    if (existingForSociety.length > 0) {
      console.log("Tables already exist for society, skipping seed");
      return;
    }

    // Sample tables with different capacities and descriptions
    const sampleTables = [
      {
        societyId,
        name: "Mahaia 1",
        minCapacity: 2,
        maxCapacity: 4,
        description: "Barrutik dagoen mahaia, bikoteentzat aproposa",
        isActive: true,
      },
      {
        societyId,
        name: "Mahaia 2",
        minCapacity: 2,
        maxCapacity: 4,
        description: "Barrutik dagoen beste mahaia",
        isActive: true,
      },
      {
        societyId,
        name: "Mahaia 3",
        minCapacity: 4,
        maxCapacity: 6,
        description: "Talde txikientzako mahaia, barrutik kokatua",
        isActive: true,
      },
      {
        societyId,
        name: "Mahaia 4",
        minCapacity: 4,
        maxCapacity: 8,
        description: "Terrazan dagoen mahaia, egun egunerako perfektua",
        isActive: true,
      },
      {
        societyId,
        name: "Mahaia 5",
        minCapacity: 6,
        maxCapacity: 10,
        description: "Terrazako mahaia handiena, talde handientzat",
        isActive: true,
      },
      {
        societyId,
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
