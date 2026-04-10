import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  reservationServices,
  isBuiltinReservationServiceSlug,
  slugifyReservationServiceLabel,
} from "@shared/schema";

/**
 * Resolves a unique `slug` for a society from a human label (EU and/or ES, see
 * `reservationServiceLabelSourceForSlug`), appending `-2`, `-3`, … on collision.
 * Skips slugs that match built-in reserved names unless `excludeServiceId` already owns that slug.
 */
export async function allocateUniqueReservationServiceSlug(
  societyId: string,
  labelSource: string,
  excludeServiceId?: string
): Promise<string> {
  const base = slugifyReservationServiceLabel(labelSource);
  let candidate = base;
  let counter = 2;

  for (;;) {
    if (isBuiltinReservationServiceSlug(candidate)) {
      candidate = `${base}-${counter++}`;
      continue;
    }

    const [hit] = await db
      .select({ id: reservationServices.id })
      .from(reservationServices)
      .where(
        and(eq(reservationServices.societyId, societyId), eq(reservationServices.slug, candidate))
      )
      .limit(1);

    if (!hit || hit.id === excludeServiceId) {
      return candidate;
    }
    candidate = `${base}-${counter++}`;
  }
}
