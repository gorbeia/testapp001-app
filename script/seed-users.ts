import "dotenv/config";
import { users, societies } from "../shared/schema";
import type { AccessRole, MembershipType } from "../shared/permissions";
import { eq } from "drizzle-orm";
import { DEMO_SOCIETY_ALPHABETIC_ID, DEMO_SOCIETY_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";

const USER_UUIDS = {
  admin: "550e8400-e29b-41d4-a716-446655440001",
  diruzaina: "550e8400-e29b-41d4-a716-446655440002",
  sotolaria: "550e8400-e29b-41d4-a716-446655440003",
  bazkidea: "550e8400-e29b-41d4-a716-446655440004",
  laguna: "550e8400-e29b-41d4-a716-446655440005",
};

export async function seedUsers(dbConn: SeedDb) {
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
        throw new Error("No societies found in database");
      }
      societyId = firstSociety[0].id;
    }
  }

  console.log("Using society ID:", societyId);

  const plainPassword = "demo";
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const demoUsers: Array<{
    id: string;
    username: string;
    password: string;
    name: string;
    membershipType: MembershipType;
    accessRole: AccessRole;
    phone: string;
    iban: string | null;
    societyId: string;
    linkedMemberId: string | null;
    linkedMemberName: string | null;
  }> = [
    {
      id: USER_UUIDS.admin,
      username: "admin@txokoa.eus",
      password: hashedPassword,
      name: "Mikel Etxeberria",
      membershipType: "full_member",
      accessRole: "admin",
      phone: "+34 943 123 456",
      iban: "ES91 2100 0418 4502 0005 1332",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.diruzaina,
      username: "diruzaina@txokoa.eus",
      password: hashedPassword,
      name: "Ane Zelaia",
      membershipType: "full_member",
      accessRole: "treasurer",
      phone: "+34 943 234 567",
      iban: "ES91 2100 0418 4502 0005 1333",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.sotolaria,
      username: "sotolaria@txokoa.eus",
      password: hashedPassword,
      name: "Jon Agirre",
      membershipType: "full_member",
      accessRole: "cellarman",
      phone: "+34 943 345 678",
      iban: "ES91 2100 0418 4502 0005 1334",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.bazkidea,
      username: "bazkidea@txokoa.eus",
      password: hashedPassword,
      name: "Miren Urrutia",
      membershipType: "full_member",
      accessRole: "member",
      phone: "+34 943 456 789",
      iban: "ES91 2100 0418 4502 0005 1335",
      societyId,
      linkedMemberId: null,
      linkedMemberName: null,
    },
    {
      id: USER_UUIDS.laguna,
      username: "laguna@txokoa.eus",
      password: hashedPassword,
      name: "Andoni Garcia",
      membershipType: "companion",
      accessRole: "member",
      phone: "+34 943 567 890",
      iban: null,
      societyId,
      linkedMemberId: null,
      linkedMemberName: "Miren Urrutia",
    },
  ];

  console.log("Seeding demo users with predefined UUIDs...");

  for (const user of demoUsers) {
    // Upsert so RBAC columns stay correct after migrations (e.g. 0005 defaulted NULL access_role to member).
    await dbConn
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.username,
        set: {
          password: user.password,
          name: user.name,
          accessRole: user.accessRole,
          membershipType: user.membershipType,
          phone: user.phone,
          iban: user.iban,
          societyId: user.societyId,
          linkedMemberId: user.linkedMemberId,
          linkedMemberName: user.linkedMemberName,
          updatedAt: new Date(),
        },
      });
  }

  console.log("Done. Users seeded with stable UUIDs.");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedUsers(db)
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
