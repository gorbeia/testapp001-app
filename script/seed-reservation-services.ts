import "dotenv/config";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import type { SeedDb } from "./seed-db-type";
import {
  reservations,
  reservationServices,
  societies,
  computeReservationServiceLineTotal,
  reservationServicePriceToDecimalString,
  RESERVATION_SERVICE_SLUG_KITCHEN,
  type ReservationServiceSnapshot,
} from "../shared/schema";
import { ensureDefaultReservationServicesForSociety } from "../server/lib/reservation-services-defaults";

/**
 * Ensures built-in reservation services (kitchen, cleaning, heating) exist for every society,
 * normalizes kitchen as default-selected, and backfills `reservations.selected_services` for
 * legacy rows with use_kitchen = true.
 */
export async function seedReservationServices(dbConn: SeedDb = db): Promise<void> {
  const allSocieties = await dbConn.select().from(societies);
  for (const s of allSocieties) {
    await ensureDefaultReservationServicesForSociety(dbConn, s.id, s.kitchenPricePerMember);
  }

  await dbConn
    .update(reservationServices)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(reservationServices.slug, RESERVATION_SERVICE_SLUG_KITCHEN));

  const kitchenRows = await dbConn
    .select()
    .from(reservationServices)
    .where(eq(reservationServices.slug, RESERVATION_SERVICE_SLUG_KITCHEN));

  for (const ks of kitchenRows) {
    const toBackfill = await dbConn
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.societyId, ks.societyId),
          eq(reservations.useKitchen, true),
          sql`${reservations.selectedServices} = '[]'::jsonb`
        )
      );

    for (const r of toBackfill) {
      const guests = r.guests ?? 0;
      const fixedStr = reservationServicePriceToDecimalString(ks.fixedPrice);
      const perStr = reservationServicePriceToDecimalString(ks.pricePerMember);
      const lineTotal = computeReservationServiceLineTotal(
        ks.fixedPrice,
        ks.pricePerMember,
        guests
      );
      const snap: ReservationServiceSnapshot = {
        serviceId: ks.id,
        slug: ks.slug,
        label: ks.labelEu,
        fixedPrice: fixedStr,
        pricePerMember: perStr,
        lineTotal,
      };
      await dbConn
        .update(reservations)
        .set({
          selectedServices: [snap],
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, r.id));
    }
  }
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedReservationServices()
    .then(() => console.log("seed-reservation-services: done"))
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
