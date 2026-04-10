import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  societyEvents,
  tables,
  createSocietyEventBodySchema,
  updateSocietyEventBodySchema,
  type JwtSessionUser,
} from "@shared/schema";
import { and, asc, eq, gte, lte, inArray } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requirePermission } from "./middleware";
import { Permission } from "@shared/permissions";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

function parseMonthRange(month: string): { from: Date; to: Date } | null {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  const from = new Date(y, mo - 1, 1, 0, 0, 0, 0);
  const to = new Date(y, mo, 0, 23, 59, 59, 999);
  return { from, to };
}

function normalizeFullDayRange(isFullDay: boolean, startDate: Date, endDate: Date) {
  if (!isFullDay) return { startDate, endDate };
  const s = new Date(startDate);
  s.setHours(0, 0, 0, 0);
  const e = new Date(endDate);
  e.setHours(23, 59, 59, 999);
  return { startDate: s, endDate: e };
}

async function assertBlockedTableIdsBelongToSociety(
  societyId: string,
  ids: string[]
): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await db
    .select({ id: tables.id })
    .from(tables)
    .where(and(eq(tables.societyId, societyId), inArray(tables.id, ids)));
  return rows.length === ids.length;
}

export function registerSocietyEventRoutes(app: Express) {
  app.get(
    "/api/society-events",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const { month, from: fromQ, to: toQ } = req.query;

        let rangeFrom: Date;
        let rangeTo: Date;

        if (month && typeof month === "string") {
          const parsed = parseMonthRange(month);
          if (!parsed) {
            return res.status(400).json({ message: "Invalid month (use YYYY-MM)" });
          }
          rangeFrom = parsed.from;
          rangeTo = parsed.to;
        } else if (fromQ && toQ && typeof fromQ === "string" && typeof toQ === "string") {
          rangeFrom = new Date(fromQ);
          rangeTo = new Date(toQ);
          if (Number.isNaN(rangeFrom.getTime()) || Number.isNaN(rangeTo.getTime())) {
            return res.status(400).json({ message: "Invalid from or to date" });
          }
          if (rangeTo < rangeFrom) {
            return res.status(400).json({ message: "to must be on or after from" });
          }
        } else {
          return res
            .status(400)
            .json({ message: "Provide month=YYYY-MM or from and to (ISO dates)" });
        }

        const rows = await db
          .select()
          .from(societyEvents)
          .where(
            and(
              eq(societyEvents.societyId, societyId),
              lte(societyEvents.startDate, rangeTo),
              gte(societyEvents.endDate, rangeFrom)
            )
          )
          .orderBy(asc(societyEvents.startDate));

        return res.status(200).json(rows);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/society-events/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const societyId = getUserSocietyId(req.user!);
        const row = await db.query.societyEvents.findFirst({
          where: and(eq(societyEvents.id, id), eq(societyEvents.societyId, societyId)),
        });
        if (!row) {
          return res.status(404).json({ message: "Event not found" });
        }
        return res.status(200).json(row);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/society-events",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.CALENDAR_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createSocietyEventBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid society event payload", issues: parsed.error.flatten() });
        }

        const societyId = getUserSocietyId(req.user!);
        const blockedIds = parsed.data.blockedTableIds ?? [];
        const okTables = await assertBlockedTableIdsBelongToSociety(societyId, blockedIds);
        if (!okTables) {
          return res
            .status(400)
            .json({ message: "One or more table ids are invalid for this society" });
        }

        const { startDate, endDate } = normalizeFullDayRange(
          parsed.data.isFullDay ?? true,
          parsed.data.startDate,
          parsed.data.endDate
        );

        const [row] = await db
          .insert(societyEvents)
          .values({
            societyId,
            createdBy: req.user!.id,
            title: parsed.data.title,
            type: parsed.data.type,
            isFullDay: parsed.data.isFullDay,
            startDate,
            endDate,
            blocksAllReservations: parsed.data.blocksAllReservations,
            blocksKitchen: parsed.data.blocksKitchen,
            blockedTableIds: blockedIds,
            notes: parsed.data.notes ?? null,
          })
          .returning();

        return res.status(201).json(row);
      } catch (err) {
        next(err);
      }
    }
  );

  app.put(
    "/api/society-events/:id",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.CALENDAR_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const societyId = getUserSocietyId(req.user!);
        const parsed = updateSocietyEventBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid society event payload", issues: parsed.error.flatten() });
        }

        if (Object.keys(parsed.data).length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }

        const existing = await db.query.societyEvents.findFirst({
          where: and(eq(societyEvents.id, id), eq(societyEvents.societyId, societyId)),
        });
        if (!existing) {
          return res.status(404).json({ message: "Event not found" });
        }

        if (parsed.data.blockedTableIds !== undefined) {
          const okTables = await assertBlockedTableIdsBelongToSociety(
            societyId,
            parsed.data.blockedTableIds
          );
          if (!okTables) {
            return res
              .status(400)
              .json({ message: "One or more table ids are invalid for this society" });
          }
        }

        const nextIsFullDay = parsed.data.isFullDay ?? existing.isFullDay;
        const nextStart = parsed.data.startDate ?? existing.startDate;
        const nextEnd = parsed.data.endDate ?? existing.endDate;
        const { startDate, endDate } = normalizeFullDayRange(nextIsFullDay, nextStart, nextEnd);

        if (endDate < startDate) {
          return res.status(400).json({ message: "endDate must be on or after startDate" });
        }

        const updates: Partial<typeof societyEvents.$inferInsert> = {
          updatedAt: new Date(),
          startDate,
          endDate,
          isFullDay: nextIsFullDay,
        };

        if (parsed.data.title !== undefined) updates.title = parsed.data.title;
        if (parsed.data.type !== undefined) updates.type = parsed.data.type;
        if (parsed.data.blocksAllReservations !== undefined) {
          updates.blocksAllReservations = parsed.data.blocksAllReservations;
        }
        if (parsed.data.blocksKitchen !== undefined) {
          updates.blocksKitchen = parsed.data.blocksKitchen;
        }
        if (parsed.data.blockedTableIds !== undefined) {
          updates.blockedTableIds = parsed.data.blockedTableIds;
        }
        if (parsed.data.notes !== undefined) {
          updates.notes = parsed.data.notes;
        }

        const [row] = await db
          .update(societyEvents)
          .set(updates)
          .where(and(eq(societyEvents.id, id), eq(societyEvents.societyId, societyId)))
          .returning();

        return res.status(200).json(row);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    "/api/society-events/:id",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.CALENDAR_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const societyId = getUserSocietyId(req.user!);
        const deleted = await db
          .delete(societyEvents)
          .where(and(eq(societyEvents.id, id), eq(societyEvents.societyId, societyId)))
          .returning({ id: societyEvents.id });
        if (!deleted.length) {
          return res.status(404).json({ message: "Event not found" });
        }
        return res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );
}
