import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export function getUploadsRoot(): string {
  const raw = process.env.UPLOADS_DIR?.trim();
  if (!raw) return DEFAULT_UPLOADS_DIR;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

export function societyUploadDir(societyId: string): string {
  return path.join(getUploadsRoot(), societyId);
}

const MAX_ORIGINAL_WIDTH = 1200;
const THUMB_SIZE = 200;

export type ProcessedImageFilenames = {
  filename: string;
  thumbFilename: string;
};

/** Convert buffer to WebP full + cover thumbnail; returns filenames (not full paths). */
export async function writeImageVariants(
  societyId: string,
  stem: string,
  buffer: Buffer
): Promise<ProcessedImageFilenames> {
  const dir = societyUploadDir(societyId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${stem}.webp`;
  const thumbFilename = `${stem}_thumb.webp`;

  const pipeline = sharp(buffer).rotate();

  const resized = await pipeline
    .clone()
    .resize(MAX_ORIGINAL_WIDTH, null, { withoutEnlargement: true, fit: "inside" })
    .webp({ quality: 85 })
    .toBuffer();

  const thumbBuf = await sharp(buffer)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();

  await fs.writeFile(path.join(dir, filename), resized);
  await fs.writeFile(path.join(dir, thumbFilename), thumbBuf);

  return { filename, thumbFilename };
}

/** Remove `{stem}.webp` and `{stem}_thumb.webp` if they exist. */
export async function removeImageVariants(
  societyId: string,
  storedFilename: string | null | undefined
) {
  if (!storedFilename || !storedFilename.endsWith(".webp") || storedFilename.includes("..")) {
    return;
  }
  const stem = storedFilename.replace(/\.webp$/i, "");
  if (!stem || stem.includes("/") || stem.includes("\\")) return;

  const dir = societyUploadDir(societyId);
  const full = path.join(dir, `${stem}.webp`);
  const thumb = path.join(dir, `${stem}_thumb.webp`);
  await Promise.all([
    fs.unlink(full).catch(() => undefined),
    fs.unlink(thumb).catch(() => undefined),
  ]);
}
