import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import sharp from "sharp";
import { eq, and } from "drizzle-orm";
import { societies, users, products } from "../shared/schema";
import { DEMO_SOCIETY_ID } from "./seed-demo-society";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { writeImageVariants } from "../server/lib/image-storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_ASSETS = path.join(__dirname, "seed-assets", "images");

/** Matches stable admin UUID in `script/seed-users.ts`. */
const DEMO_ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655440001";

const DEMO_PRODUCT_NAMES = ["Kalea Garagardoa", "Txakoli Getariako", "Kafea"] as const;

async function rgbaBuffer(width: number, height: number, r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

async function tryReadOptionalAsset(name: string): Promise<Buffer | null> {
  const p = path.join(SEED_ASSETS, name);
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

export async function seedImages(dbConn: SeedDb) {
  const [soc] = await dbConn.select().from(societies).where(eq(societies.id, DEMO_SOCIETY_ID)).limit(1);
  if (!soc) {
    console.log("Demo society not found — skipping seed-images (expected after seed-societies with GT001).");
    return;
  }

  const societyId = soc.id;
  console.log("Seeding demo images for society:", societyId);

  const [sLogo] = await dbConn
    .select({ logoUrl: societies.logoUrl })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  if (!sLogo?.logoUrl) {
    const fromFile = await tryReadOptionalAsset("logo.png");
    const buf = fromFile ?? (await rgbaBuffer(400, 400, 30, 70, 140));
    const { filename } = await writeImageVariants(societyId, "seed_demo_logo", buf);
    await dbConn
      .update(societies)
      .set({ logoUrl: filename, updatedAt: new Date() })
      .where(eq(societies.id, societyId));
    console.log("  Society logo:", filename);
  } else {
    console.log("  Society logo already set, skipping.");
  }

  const [sMap] = await dbConn
    .select({ mapImageUrl: societies.mapImageUrl })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  if (!sMap?.mapImageUrl) {
    const fromFile = await tryReadOptionalAsset("map.png");
    const buf = fromFile ?? (await rgbaBuffer(800, 520, 230, 228, 220));
    const { filename } = await writeImageVariants(societyId, "seed_demo_map", buf);
    await dbConn
      .update(societies)
      .set({ mapImageUrl: filename, updatedAt: new Date() })
      .where(eq(societies.id, societyId));
    console.log("  Society map:", filename);
  } else {
    console.log("  Society map already set, skipping.");
  }

  const [uAv] = await dbConn
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, DEMO_ADMIN_USER_ID))
    .limit(1);
  if (uAv && !uAv.avatarUrl) {
    const fromFile = await tryReadOptionalAsset("avatar-default.png");
    const buf = fromFile ?? (await rgbaBuffer(320, 320, 90, 120, 85));
    const { filename } = await writeImageVariants(societyId, "seed_demo_avatar", buf);
    await dbConn
      .update(users)
      .set({ avatarUrl: filename, updatedAt: new Date() })
      .where(eq(users.id, DEMO_ADMIN_USER_ID));
    console.log("  Admin avatar:", filename);
  } else {
    console.log("  Admin avatar already set or user missing, skipping.");
  }

  const productColors: Array<[number, number, number]> = [
    [139, 90, 43],
    [180, 60, 80],
    [55, 35, 25],
  ];

  for (let i = 0; i < DEMO_PRODUCT_NAMES.length; i++) {
    const name = DEMO_PRODUCT_NAMES[i];
    const [p] = await dbConn
      .select()
      .from(products)
      .where(and(eq(products.societyId, societyId), eq(products.name, name)))
      .limit(1);
    if (!p) {
      console.log(`  Product "${name}" not found, skipping image.`);
      continue;
    }
    if (p.imageUrl) {
      console.log(`  Product "${name}" image already set, skipping.`);
      continue;
    }
    const optional = await tryReadOptionalAsset(`product-${i + 1}.png`);
    const [r, g, b] = productColors[i]!;
    const buf = optional ?? (await rgbaBuffer(360, 360, r, g, b));
    const { filename } = await writeImageVariants(societyId, `seed_prod_${i}`, buf);
    await dbConn
      .update(products)
      .set({ imageUrl: filename, updatedAt: new Date() })
      .where(eq(products.id, p.id));
    console.log(`  Product "${name}" image:`, filename);
  }

  console.log("seed-images done.");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedImages(db)
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
