/**
 * Normalize catalog product images for POS display.
 *
 * Each image is center-cropped to a square and resized to TARGET_SIZE×TARGET_SIZE.
 * Wide images are cropped on the sides; tall images are cropped top/bottom.
 * Already-correct images are skipped (no write).
 *
 * Usage:
 *   pnpm normalize:catalog-images          # process in-place
 *   pnpm normalize:catalog-images --dry-run # preview only, no writes
 */

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TARGET_SIZE = 512;
const CATALOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/public/catalog/products"
);

const dryRun = process.argv.includes("--dry-run");

async function processImage(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  const meta = await sharp(filePath).metadata();
  const { width = 0, height = 0, format } = meta;

  const alreadySquare = width === height;
  const alreadyTargetSize = width === TARGET_SIZE && height === TARGET_SIZE && format === "png";

  if (alreadyTargetSize) {
    console.log(`  ok    ${filename}  (${width}×${height}, no change needed)`);
    return;
  }

  const cropSide = Math.min(width, height);
  const formatNote = format !== "png" ? ` [${format}→png]` : "";
  const action = alreadySquare
    ? `resize ${width}×${height} → ${TARGET_SIZE}×${TARGET_SIZE}${formatNote}`
    : `center-crop ${width}×${height} → ${cropSide}×${cropSide}, resize → ${TARGET_SIZE}×${TARGET_SIZE}${formatNote}`;

  if (dryRun) {
    console.log(`  would ${filename}  (${action})`);
    return;
  }

  // Write to a temp file first, then replace, to avoid partial writes
  const tmpPath = filePath + ".tmp";
  await sharp(filePath)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 8 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, filePath);
  console.log(`  done  ${filename}  (${action})`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`Catalog directory not found: ${CATALOG_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(CATALOG_DIR)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .sort()
    .map(f => path.join(CATALOG_DIR, f));

  console.log(
    `Normalizing ${files.length} image(s) → ${TARGET_SIZE}×${TARGET_SIZE} (center-crop)${dryRun ? "  [dry-run]" : ""}\n`
  );

  for (const file of files) {
    await processImage(file);
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
