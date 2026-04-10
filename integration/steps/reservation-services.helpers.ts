import { and, eq } from "drizzle-orm";
import { db } from "../../server/db";
import {
  reservationServices,
  societies,
  RESERVATION_SERVICE_SLUG_KITCHEN,
} from "@shared/schema";
import { DEMO_SOCIETY_ALPHABETIC_ID } from "../../script/seed-demo-society";

/** Kitchen add-on service id for the demo society (GT001), for integration POST bodies. */
export async function getDemoSocietyKitchenServiceId(): Promise<string> {
  const [soc] = await db
    .select({ id: societies.id })
    .from(societies)
    .where(eq(societies.alphabeticId, DEMO_SOCIETY_ALPHABETIC_ID))
    .limit(1);
  if (!soc) {
    throw new Error(`Demo society ${DEMO_SOCIETY_ALPHABETIC_ID} not found`);
  }
  const [svc] = await db
    .select({ id: reservationServices.id })
    .from(reservationServices)
    .where(
      and(
        eq(reservationServices.societyId, soc.id),
        eq(reservationServices.slug, RESERVATION_SERVICE_SLUG_KITCHEN)
      )
    )
    .limit(1);
  if (!svc) {
    throw new Error("Kitchen reservation service not seeded for demo society");
  }
  return svc.id;
}
