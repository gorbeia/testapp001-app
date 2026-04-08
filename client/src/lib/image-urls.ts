/** Build public URL for an uploaded image stored as `{societyId}/{filename}`. */
export function tenantImageSrc(societyId: string | undefined, filename: string | null | undefined): string | undefined {
  if (!societyId || !filename?.trim()) return undefined;
  const safe = filename.trim();
  if (safe.includes("..") || safe.includes("/") || safe.includes("\\")) return undefined;
  return `/api/images/${societyId}/${encodeURIComponent(safe)}`;
}

export function societyLogoSrc(
  societyId: string | undefined,
  logoUrl: string | null | undefined
): string | undefined {
  return tenantImageSrc(societyId, logoUrl);
}

export function societyMapSrc(
  societyId: string | undefined,
  mapImageUrl: string | null | undefined
): string | undefined {
  return tenantImageSrc(societyId, mapImageUrl);
}

export function userAvatarSrc(
  societyId: string | undefined,
  avatarUrl: string | null | undefined
): string | undefined {
  return tenantImageSrc(societyId, avatarUrl);
}

export function productImageSrc(
  societyId: string | undefined,
  imageUrl: string | null | undefined
): string | undefined {
  return tenantImageSrc(societyId, imageUrl);
}

/** Derives thumbnail filename stored alongside full-size WebP (`{id}_thumb.webp`). */
export function thumbFilenameFromImageUrl(filename: string | null | undefined): string | undefined {
  if (!filename?.endsWith(".webp")) return undefined;
  return `${filename.replace(/\.webp$/i, "")}_thumb.webp`;
}
