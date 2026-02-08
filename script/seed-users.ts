import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { users, societies } from "../shared/schema";
import { eq } from "drizzle-orm";

// Predefined UUIDs for consistent user IDs across database resets
const USER_UUIDS = {
  admin: "550e8400-e29b-41d4-a716-446655440001",
  diruzaina: "550e8400-e29b-41d4-a716-446655440002",
  sotolaria: "550e8400-e29b-41d4-a716-446655440003",
  bazkidea: "550e8400-e29b-41d4-a716-446655440004",
  laguna: "550e8400-e29b-41d4-a716-446655440005",
};

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

  const demoUsers = [
    {
      id: USER_UUIDS.admin,
      username: "admin@txokoa.eus",
      password: "demo",
      name: "Mikel Etxeberria",
      role: "bazkidea",
      function: "administratzailea",
      phone: "+34 943 123 456",
      iban: "ES91 2100 0418 4502 0005 1332",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.diruzaina,
      username: "diruzaina@txokoa.eus",
      password: "demo",
      name: "Ane Zelaia",
      role: "bazkidea",
      function: "diruzaina",
      phone: "+34 943 234 567",
      iban: "ES91 2100 0418 4502 0005 1333",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.sotolaria,
      username: "sotolaria@txokoa.eus",
      password: "demo",
      name: "Jon Agirre",
      role: "bazkidea",
      function: "sotolaria",
      phone: "+34 943 345 678",
      iban: "ES91 2100 0418 4502 0005 1334",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.bazkidea,
      username: "bazkidea@txokoa.eus",
      password: "demo",
      name: "Miren Urrutia",
      role: "bazkidea",
      function: "arrunta",
      phone: "+34 943 456 789",
      iban: "ES91 2100 0418 4502 0005 1335",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.laguna,
      username: "laguna@txokoa.eus",
      password: "demo",
      name: "Andoni Garcia",
      role: "laguna",
      function: "arrunta",
      phone: "+34 943 567 890",
      iban: null,
      societyId,
      linkedMemberId: null,
      linkedMemberName: "Miren Urrutia",
    },
  ];

  console.log("Seeding demo users with predefined UUIDs...");

  for (const user of demoUsers) {
    await db.insert(users).values(user).onConflictDoNothing({ target: users.username });
  }

  console.log("Done. Users seeded with stable UUIDs.");
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
