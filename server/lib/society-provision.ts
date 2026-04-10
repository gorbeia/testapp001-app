import type { AppDatabase } from "../db";

/**
 * Base slug for `societies.alphabetic_id` from display name (same rules as backoffice create).
 */
export function slugAlphabeticIdBaseFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20);
}

/**
 * Resolves a unique `alphabetic_id` for a new society (collision suffix `-1`, `-2`, …).
 */
export async function allocateUniqueAlphabeticId(
  dbConn: { query: AppDatabase["query"] },
  name: string
): Promise<string> {
  const base = slugAlphabeticIdBaseFromName(name);
  const alphabeticId = base || "society";
  let final = alphabeticId;
  let counter = 1;
  for (;;) {
    const existing = await dbConn.query.societies.findFirst({
      where: (s, { eq: e }) => e(s.alphabeticId, final),
    });
    if (!existing) break;
    final = `${alphabeticId}-${counter}`;
    counter += 1;
  }
  return final;
}
