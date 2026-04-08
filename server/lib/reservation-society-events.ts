import { db } from "../db";
import { societyEvents, tables } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { translateWithParams, type Language } from "./i18n";

/**
 * If the reservation instant falls inside a society calendar event that blocks
 * this booking, return a 409 payload; otherwise null.
 */
export async function getReservationBlockBySocietyEvents(
  societyId: string,
  args: { startDate: Date; useKitchen: boolean; table: string },
  language: Language
): Promise<{ message: string } | null> {
  const overlapping = await db
    .select()
    .from(societyEvents)
    .where(
      and(
        eq(societyEvents.societyId, societyId),
        lte(societyEvents.startDate, args.startDate),
        gte(societyEvents.endDate, args.startDate)
      )
    );

  const tableRow = await db.query.tables.findFirst({
    where: and(eq(tables.societyId, societyId), eq(tables.name, args.table)),
  });
  const tableId = tableRow?.id;

  for (const ev of overlapping) {
    if (ev.blocksAllReservations) {
      return {
        message: translateWithParams(
          "reservationBlockedBySocietyEvent",
          { title: ev.title },
          language
        ),
      };
    }
    if (args.useKitchen && ev.blocksKitchen) {
      return {
        message: translateWithParams(
          "reservationBlockedKitchenByEvent",
          { title: ev.title },
          language
        ),
      };
    }
    const blocked = ev.blockedTableIds ?? [];
    if (tableId && blocked.includes(tableId)) {
      return {
        message: translateWithParams(
          "reservationBlockedTableByEvent",
          { title: ev.title },
          language
        ),
      };
    }
  }

  return null;
}
