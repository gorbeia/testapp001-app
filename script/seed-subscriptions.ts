import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { subscriptionTypes, societies } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  console.log("Seeding subscription types...");

  // Get the first society (assuming there's at least one)
  const existingSocieties = await db.select().from(societies).limit(1);
  if (existingSocieties.length === 0) {
    console.log("No societies found, please seed societies first.");
    await client.end();
    return;
  }

  const societyId = existingSocieties[0].id;

  // Check if subscription types already exist for this society
  const existingSubscriptions = await db
    .select()
    .from(subscriptionTypes)
    .where(eq(subscriptionTypes.societyId, societyId));

  if (existingSubscriptions.length > 0) {
    console.log("Subscription types already exist, skipping seed.");
    await client.end();
    return;
  }

  const defaultSubscriptionTypes = [
    {
      name: "Harpidetza Urteroko",
      description: "Urteko harpidetza estandarra",
      amount: "60.00",
      period: "yearly",
      periodMonths: 12,
      isActive: true,
      autoRenew: true,
      societyId,
    },
  ];

  for (const subscriptionType of defaultSubscriptionTypes) {
    await db.insert(subscriptionTypes).values(subscriptionType);
  }

  console.log("Done seeding subscription types.");
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
