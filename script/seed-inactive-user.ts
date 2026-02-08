import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { users, societies } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const db = drizzle(client);

  // Get the active society or the first one
  let societyId = "";
  const activeSociety = await db
    .select()
    .from(societies)
    .where(eq(societies.isActive, true))
    .limit(1);
  if (activeSociety.length === 0) {
    const firstSociety = await db.select().from(societies).limit(1);
    if (firstSociety.length === 0) {
      throw new Error("No societies found in database");
    }
    societyId = firstSociety[0].id;
  } else {
    societyId = activeSociety[0].id;
  }

  console.log("Using society ID:", societyId);

  const inactiveUser = {
    username: "bazkide-ezaktiboa@txokoa.eus",
    password: "demo",
    name: "Patxi Mendizabal",
    role: "bazkidea",
    function: "arrunta",
    phone: "+34 943 678 901",
    iban: "ES91 2100 0418 4502 0005 1336",
    societyId,
    linkedMemberId: null,
    linkedMemberName: null,
    isActive: false, // This user is inactive
  };

  console.log("Seeding inactive demo user...");

  await db.insert(users).values(inactiveUser).onConflictDoNothing({ target: users.username });

  console.log("Inactive user seeded successfully.");
  console.log("Username: bazkide-ezaktiboa@txokoa.eus");
  console.log("Password: demo");
  console.log("Status: Inactive (will not appear in user listings)");

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
