import "dotenv/config";
import { fileURLToPath } from "node:url";
import { db, pool } from "../server/db";
import { seedSocieties } from "./seed-societies";
import { seedUsers } from "./seed-users";
import { seedSuperadmins } from "./seed-superadmins";
import { seedCategories } from "./seed-categories";
import { seedProducts } from "./seed-products";
import { seedConsumptions } from "./seed-consumptions";
import { seedTables } from "./seed-tables";
import { seedReservations } from "./seed-reservations";
import { seedNotes } from "./seed-notes";
import { seedNotifications } from "./seed-notifications";
import { seedSubscriptions } from "./seed-subscriptions";

async function runAllSeeds() {
  console.log("Running database seed pipeline...\n");
  await seedSocieties(db);
  await seedUsers(db);
  await seedSuperadmins(db);
  await seedCategories(db);
  await seedProducts(db);
  await seedConsumptions(db);
  await seedTables(db);
  await seedReservations(db);
  await seedNotes(db);
  await seedNotifications(db);
  await seedSubscriptions(db);
  console.log("\nAll seed steps finished.");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runAllSeeds()
    .then(() => {
      console.log("Seed pipeline completed successfully.");
    })
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
