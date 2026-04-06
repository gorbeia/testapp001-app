import "dotenv/config";
import { subscriptionTypes, societies } from "../shared/schema";
import { eq } from "drizzle-orm";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedSubscriptions(dbConn: SeedDb) {
  console.log("Seeding subscription types...");

  const existingSocieties = await dbConn.select().from(societies).limit(1);
  if (existingSocieties.length === 0) {
    console.log("No societies found, please seed societies first.");
    return;
  }

  const societyId = existingSocieties[0].id;

  const existingSubscriptions = await dbConn
    .select()
    .from(subscriptionTypes)
    .where(eq(subscriptionTypes.societyId, societyId));

  if (existingSubscriptions.length > 0) {
    console.log("Subscription types already exist, skipping seed.");
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
    await dbConn.insert(subscriptionTypes).values(subscriptionType);
  }

  console.log("Done seeding subscription types.");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedSubscriptions(db)
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() =>
      pool.end().then(() => {
        process.exit(process.exitCode ?? 0);
      })
    );
}
