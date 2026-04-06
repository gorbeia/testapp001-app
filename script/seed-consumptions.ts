import "dotenv/config";
import { consumptions, consumptionItems, users, products, societies } from "../shared/schema";
import { eq } from "drizzle-orm";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedConsumptions(dbConn: SeedDb) {
  let societyId = "";
  const activeSociety = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.isActive, true))
    .limit(1);
  if (activeSociety.length === 0) {
    const firstSociety = await dbConn.select().from(societies).limit(1);
    if (firstSociety.length === 0) {
      throw new Error("No societies found in database");
    }
    societyId = firstSociety[0].id;
  } else {
    societyId = activeSociety[0].id;
  }

  console.log("Using society ID for consumptions:", societyId);
  console.log("Seeding demo consumptions...");

  const demoUsers = await dbConn.select().from(users).limit(3);
  const demoProducts = await dbConn.select().from(products).limit(5);

  if (demoUsers.length === 0 || demoProducts.length === 0) {
    console.log("No users or products found. Please run seed-users and seed-products first.");
    return;
  }

  const novemberDates = [
    new Date(2025, 10, 5),
    new Date(2025, 10, 12),
    new Date(2025, 10, 18),
    new Date(2025, 10, 25),
    new Date(2025, 10, 28),
  ];

  const demoConsumptions = [
    {
      userId: demoUsers[0].id,
      totalAmount: "15.50",
      notes: "Ondo pasatako arratsaldea",
      createdAt: novemberDates[0],
      closedAt: novemberDates[0],
      closedBy: demoUsers[0].id,
    },
    {
      userId: demoUsers[1].id,
      totalAmount: "8.00",
      notes: "Kontsumo irekia",
      createdAt: novemberDates[1],
    },
    {
      userId: demoUsers[2].id,
      totalAmount: "42.75",
      notes: "Urtebetetze festa",
      createdAt: novemberDates[2],
      closedAt: novemberDates[2],
      closedBy: demoUsers[0].id,
    },
    {
      userId: demoUsers[0].id,
      totalAmount: "12.25",
      notes: "Asteguneko kontsumoa",
      createdAt: novemberDates[3],
    },
    {
      userId: demoUsers[1].id,
      totalAmount: "6.50",
      notes: "Azken kontsumoa",
      createdAt: novemberDates[4],
      closedAt: novemberDates[4],
      closedBy: demoUsers[1].id,
    },
  ];

  for (const consumptionData of demoConsumptions) {
    const [consumption] = await dbConn
      .insert(consumptions)
      .values({
        ...consumptionData,
        societyId,
      })
      .returning();

    const itemsToAdd = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < itemsToAdd && i < demoProducts.length; i++) {
      const product = demoProducts[i];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * quantity;

      await dbConn.insert(consumptionItems).values({
        consumptionId: consumption.id,
        productId: product.id,
        quantity,
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
        notes: `Demo kontsumo item ${i + 1}`,
      });
    }
  }

  console.log("Demo consumptions seeded successfully!");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedConsumptions(db)
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
