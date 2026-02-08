import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { societies } from "../shared/schema";

// Predefined UUID for consistent society ID across database resets
const SOCIETY_UUID = "550e8400-e29b-41d4-a716-446655440000";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  console.log("Seeding societies with predefined UUID...");

  // Check if societies already exist
  const existingSocieties = await db.select().from(societies);
  if (existingSocieties.length > 0) {
    console.log("Societies already exist, skipping seed.");
    await client.end();
    return;
  }

  const demoSocieties = [
    {
      id: SOCIETY_UUID,
      alphabeticId: "GT001",
      name: "Gure Txokoa",
      iban: "ES91 2100 0418 4502 0005 1330",
      creditorId: "ES45000B12345678",
      address: "Kale Nagusia 15, 20001 Donostia",
      phone: "+34 943 111 222",
      email: "info@guretxokoa.eus",
      reservationPricePerMember: "2.00",
      kitchenPricePerMember: "3.00",
      isActive: true,
    },
  ];

  for (const society of demoSocieties) {
    await db.insert(societies).values(society);
  }

  console.log("Done. Society seeded with stable UUID.");
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
