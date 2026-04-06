import "dotenv/config";
import { superadmins } from "../shared/schema";
import bcrypt from "bcrypt";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedSuperadmins(dbConn: SeedDb) {
  console.log("🔐 Seeding superadmins...");

  const demoPassword = "demo";
  const hashedPassword = await bcrypt.hash(demoPassword, 10);

  const demoSuperadmin = {
    email: "superadmin@elkartea.eus",
    password: hashedPassword,
    name: "Demo Superadmin",
    isActive: true,
  };

  await dbConn.insert(superadmins).values(demoSuperadmin).onConflictDoNothing({
    target: superadmins.email,
  });
  console.log("✅ Demo superadmin ensured (skipped if email already exists):");
  console.log(`   Email: ${demoSuperadmin.email}`);
  console.log(`   Password: ${demoPassword}`);
  console.log("   You can now log in at /elkarteapp/kudeaketa");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedSuperadmins(db)
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
