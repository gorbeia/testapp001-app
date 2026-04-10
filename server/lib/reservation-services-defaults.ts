import { db, type AppDatabase } from "../db";
import {
  reservationServices,
  societies,
  BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_ES,
  BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_EU,
  RESERVATION_SERVICE_SLUG_CLEANING,
  RESERVATION_SERVICE_SLUG_HEATING,
  RESERVATION_SERVICE_SLUG_KITCHEN,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_CLEANING_PER_MEMBER = "5.00";

const CLEANING_LABEL_EU = "Garbitzea";
const CLEANING_LABEL_ES = "Limpieza";
const HEATING_LABEL_EU = "Berogailua";
const HEATING_LABEL_ES = "Calefacción";

/**
 * Ensures every society has built-in kitchen, cleaning, and heating reservation services.
 * Idempotent: skips rows that already exist for each slug.
 * Pass the same `db` or transaction client that inserted the society (required inside transactions).
 */
export async function ensureDefaultReservationServicesForSociety(
  dbConn: AppDatabase,
  societyId: string,
  kitchenPricePerMember: string | null | undefined
): Promise<void> {
  const kitchenPm =
    kitchenPricePerMember != null && String(kitchenPricePerMember).trim() !== ""
      ? String(kitchenPricePerMember)
      : "10.00";

  const now = new Date();
  const conflictTarget = [reservationServices.societyId, reservationServices.slug];

  await dbConn
    .insert(reservationServices)
    .values({
      societyId,
      slug: RESERVATION_SERVICE_SLUG_KITCHEN,
      labelEu: BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_EU,
      labelEs: BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_ES,
      fixedPrice: "0.00",
      pricePerMember: kitchenPm,
      isActive: true,
      isDefault: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: conflictTarget });

  await dbConn
    .insert(reservationServices)
    .values({
      societyId,
      slug: RESERVATION_SERVICE_SLUG_CLEANING,
      labelEu: CLEANING_LABEL_EU,
      labelEs: CLEANING_LABEL_ES,
      fixedPrice: "0.00",
      pricePerMember: DEFAULT_CLEANING_PER_MEMBER,
      isActive: true,
      isDefault: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: conflictTarget });

  await dbConn
    .insert(reservationServices)
    .values({
      societyId,
      slug: RESERVATION_SERVICE_SLUG_HEATING,
      labelEu: HEATING_LABEL_EU,
      labelEs: HEATING_LABEL_ES,
      fixedPrice: "0.00",
      pricePerMember: "0.00",
      isActive: true,
      isDefault: false,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: conflictTarget });
}

/** Sync societies.kitchen_price_per_member from the kitchen service row (if present). */
export async function syncSocietyKitchenPriceFromKitchenService(societyId: string): Promise<void> {
  const [row] = await db
    .select({ pricePerMember: reservationServices.pricePerMember })
    .from(reservationServices)
    .where(
      and(
        eq(reservationServices.societyId, societyId),
        eq(reservationServices.slug, RESERVATION_SERVICE_SLUG_KITCHEN)
      )
    )
    .limit(1);

  if (!row) return;

  await db
    .update(societies)
    .set({
      kitchenPricePerMember: String(row.pricePerMember ?? "0.00"),
      updatedAt: new Date(),
    })
    .where(eq(societies.id, societyId));
}
