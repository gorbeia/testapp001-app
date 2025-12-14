import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { tables, reservations, type Table, type InsertTable } from "@shared/schema";
import { eq, and, gte, ne, count } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requireAdmin } from "./middleware";

export function registerTableRoutes(app: Express) {
  // Tables: get all tables (admin only)
  app.get("/api/tables", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allTables = await db.select().from(tables).orderBy(tables.name);
      return res.status(200).json(allTables);
    } catch (err) {
      next(err);
    }
  });

  // Tables: get available tables for reservations (authenticated users)
  app.get("/api/tables/available", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const availableTables = await db.select().from(tables).where(eq(tables.isActive, true)).orderBy(tables.name);
      return res.status(200).json(availableTables);
    } catch (err) {
      next(err);
    }
  });

  // Tables: create new table (admin only)
  app.post("/api/tables", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tableData: InsertTable = req.body;
      
      const [newTable] = await db.insert(tables).values(tableData).returning();
      
      return res.status(201).json(newTable);
    } catch (err) {
      next(err);
    }
  });

  // Tables: update table (admin only)
  app.put("/api/tables/:id", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData: Partial<Table> = req.body;
      
      // Always update the updatedAt timestamp
      updateData.updatedAt = new Date();
      
      const [updatedTable] = await db
        .update(tables)
        .set(updateData)
        .where(eq(tables.id, id))
        .returning();
      
      if (!updatedTable) {
        return res.status(404).json({ message: "Table not found" });
      }
      
      return res.status(200).json(updatedTable);
    } catch (err) {
      next(err);
    }
  });

  // Tables: delete table (admin only)
  app.delete("/api/tables/:id", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Get table name first
      const [tableInfo] = await db
        .select({ name: tables.name })
        .from(tables)
        .where(eq(tables.id, id));
      
      if (!tableInfo) {
        return res.status(404).json({ message: "Table not found" });
      }
      
      // Check if table has any active or future reservations (not cancelled or completed)
      const now = new Date();
      const [activeReservationCount] = await db
        .select({ count: count() })
        .from(reservations)
        .where(and(
          eq(reservations.table, tableInfo.name),
          gte(reservations.startDate, now),
          ne(reservations.status, 'cancelled'),
          ne(reservations.status, 'completed')
        ));
      
      if (activeReservationCount.count > 0) {
        return res.status(400).json({ 
          message: "Ezin izan da mahaia ezabatu",
          details: `Mahaiak ${activeReservationCount.count} erreserba aktibo edo etorkizunekoak ditu. Lehenengo erreserbak ezabatu edo mahaia desaktibatu.`
        });
      }
      
      const [deletedTable] = await db
        .delete(tables)
        .where(eq(tables.id, id))
        .returning();
      
      console.log(`[TABLE-DELETED] Table '${tableInfo.name}' deleted by admin`);
      
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
}
