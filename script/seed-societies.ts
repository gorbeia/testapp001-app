import "dotenv/config";
import { societies, type SocietyPaymentMethod } from "../shared/schema";
import { DEMO_SOCIETY_ALPHABETIC_ID, DEMO_SOCIETY_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

const SOCIETY_UUID = DEMO_SOCIETY_ID;

export async function seedSocieties(dbConn: SeedDb) {
  console.log("Seeding societies with predefined UUID...");

  const existingSocieties = await dbConn.select().from(societies);
  if (existingSocieties.length > 0) {
    console.log("Societies already exist, skipping seed.");
    return;
  }

  const demoSocieties = [
    {
      id: SOCIETY_UUID,
      alphabeticId: DEMO_SOCIETY_ALPHABETIC_ID,
      name: "Gure Txokoa",
      iban: "ES91 2100 0418 4502 0005 1330",
      creditorId: "ES45000B12345678",
      address: "Kale Nagusia 15, 20001 Donostia",
      phone: "+34 943 111 222",
      email: "info@guretxokoa.eus",
      reservationPricePerMember: "2.00",
      kitchenPricePerMember: "3.00",
      sepaMode: "monthly",
      paymentMethods: ["bank_transfer_prepayment", "cash_manual"] as SocietyPaymentMethod[],
      isActive: true,
    },
  ];

  for (const society of demoSocieties) {
    await dbConn.insert(societies).values(society);
  }

  console.log("Done. Society seeded with stable UUID.");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedSocieties(db)
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
