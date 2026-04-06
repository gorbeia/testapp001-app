import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  tables,
  reservations,
  insertTableSchema,
  type Table,
  type User,
} from "@shared/schema";
import { eq, and, gte, ne, count } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requireAdmin } from "./middleware";

const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerTableRoutes(app: Express) {
  // Tables: get all tables (admin only)
  app.get(
    "/api/tables",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const allTables = await db
          .select()
          .from(tables)
          .where(eq(tables.societyId, societyId))
          .orderBy(tables.name);
        return res.status(200).json(allTables);
      } catch (err) {
        next(err);
      }
    }
  );

  // Tables: get available tables for reservations (authenticated users)
  app.get(
    "/api/tables/available",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const availableTables = await db
          .select()
          .from(tables)
          .where(and(eq(tables.societyId, societyId), eq(tables.isActive, true)))
          .orderBy(tables.name);
        return res.status(200).json(availableTables);
      } catch (err) {
        next(err);
      }
    }
  );

  // Tables: create new table (admin only)
  app.post(
    "/api/tables",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = insertTableSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid table payload", issues: parsed.error.flatten() });
        }

        const societyId = getUserSocietyId(req.user!);

        const [newTable] = await db
          .insert(tables)
          .values({ ...parsed.data, societyId })
          .returning();

        return res.status(201).json(newTable);
      } catch (err) {
        next(err);
      }
    }
  );

  // Tables: update table (admin only)
  app.put(
    "/api/tables/:id",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const societyId = getUserSocietyId(req.user!);
        const updateData: Partial<Table> = req.body;

        // Always update the updatedAt timestamp
        updateData.updatedAt = new Date();
        delete updateData.societyId;

        const [updatedTable] = await db
          .update(tables)
          .set(updateData)
          .where(and(eq(tables.id, id), eq(tables.societyId, societyId)))
          .returning();

        if (!updatedTable) {
          return res.status(404).json({ message: "Table not found" });
        }

        return res.status(200).json(updatedTable);
      } catch (err) {
        next(err);
      }
    }
  );

  // Tables: delete table (admin only)
  app.delete(
    "/api/tables/:id",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const societyId = getUserSocietyId(req.user!);

        // Get table name first
        const [tableInfo] = await db
          .select({ name: tables.name })
          .from(tables)
          .where(and(eq(tables.id, id), eq(tables.societyId, societyId)));

        if (!tableInfo) {
          return res.status(404).json({ message: "Table not found" });
        }

        // Check if table has any active or future reservations (not cancelled or completed)
        const now = new Date();
        const [activeReservationCount] = await db
          .select({ count: count() })
          .from(reservations)
          .where(
            and(
              eq(reservations.societyId, societyId),
              eq(reservations.table, tableInfo.name),
              gte(reservations.startDate, now),
              ne(reservations.status, "cancelled"),
              ne(reservations.status, "completed")
            )
          );

        if (activeReservationCount.count > 0) {
          return res.status(400).json({
            message: "Ezin izan da mahaia ezabatu",
            details: `Mahaiak ${activeReservationCount.count} erreserba aktibo edo etorkizunekoak ditu. Lehenengo erreserbak ezabatu edo mahaia desaktibatu.`,
          });
        }

        const [deleted] = await db
          .delete(tables)
          .where(and(eq(tables.id, id), eq(tables.societyId, societyId)))
          .returning({ id: tables.id });

        if (!deleted) {
          return res.status(404).json({ message: "Table not found" });
        }

        return res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );
}
