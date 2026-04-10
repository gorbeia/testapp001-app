import "dotenv/config";
import { eq } from "drizzle-orm";
import { societies, tables } from "../shared/schema";
import { DEMO_SOCIETY_ALPHABETIC_ID, DEMO_SOCIETY_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedTables(dbConn: SeedDb) {
  console.log("Seeding tables...");

  let societyId = "";

  const byDemoId = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.id, DEMO_SOCIETY_ID))
    .limit(1);
  const byAlphabetic = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.alphabeticId, DEMO_SOCIETY_ALPHABETIC_ID))
    .limit(1);

  if (byDemoId.length > 0) {
    societyId = byDemoId[0].id;
  } else if (byAlphabetic.length > 0) {
    societyId = byAlphabetic[0].id;
  } else {
    const activeSociety = await dbConn
      .select()
      .from(societies)
      .where(eq(societies.isActive, true))
      .limit(1);
    if (activeSociety.length > 0) {
      societyId = activeSociety[0].id;
    } else {
      const firstSociety = await dbConn.select().from(societies).limit(1);
      if (firstSociety.length === 0) {
        console.log("No societies found, skipping table seed");
        return;
      }
      societyId = firstSociety[0].id;
    }
  }

  console.log("Seeding tables for society:", societyId);

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
      minCapacity: 2,
      maxCapacity: 10,
      description: "Terrazako mahaia handiena, talde handientzat (erreserba partzialak)",
      allowsPartialReservation: true,
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

  let inserted = 0;
  for (const row of sampleTables) {
    const result = await dbConn
      .insert(tables)
      .values({ ...row, societyId })
      .onConflictDoNothing({ target: [tables.societyId, tables.name] })
      .returning({ id: tables.id });
    if (result.length > 0) inserted += 1;
  }

  console.log(
    `Tables seed done: ${inserted} new row(s) inserted (${sampleTables.length} defined for society).`
  );
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedTables(db)
    .catch(err => {
      console.error("Error seeding tables:", err);
      process.exitCode = 1;
    })
    .finally(() =>
      pool.end().then(() => {
        process.exit(process.exitCode ?? 0);
      })
    );
}
