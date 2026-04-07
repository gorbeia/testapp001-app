import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  products,
  stockMovements,
  stockTakeLines,
  stockTakes,
  createStockTakeSchema,
  updateStockTakeLineSchema,
  paginatedQuerySchema,
  type JwtSessionUser,
  type Product,
} from "@shared/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canMutateProducts } from "@shared/permissions";
import { refreshLowStockNotificationForProduct } from "../lib/stock-notifications";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerStockTakeRoutes(app: Express) {
  app.post(
    "/api/stock-takes",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock takes not allowed" });
        }

        const parsed = createStockTakeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid stock take payload",
            issues: parsed.error.flatten(),
          });
        }

        const societyId = getUserSocietyId(user);
        const { notes, productIds } = parsed.data;

        const existingDraft = await db
          .select({ id: stockTakes.id })
          .from(stockTakes)
          .where(and(eq(stockTakes.societyId, societyId), eq(stockTakes.status, "draft")))
          .limit(1);

        if (existingDraft.length > 0) {
          return res.status(409).json({
            message: "A draft stock take already exists. Complete or cancel it first.",
            draftId: existingDraft[0].id,
          });
        }

        let productRows: Product[];

        if (productIds && productIds.length > 0) {
          productRows = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.societyId, societyId),
                eq(products.isActive, true),
                ne(products.stockMode, "none"),
                inArray(products.id, productIds)
              )
            );

          if (productRows.length !== productIds.length) {
            return res.status(400).json({
              message:
                "One or more products not found, inactive, or excluded from inventory (stock mode: none)",
            });
          }
        } else {
          productRows = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.societyId, societyId),
                eq(products.isActive, true),
                ne(products.stockMode, "none")
              )
            );
        }

        if (productRows.length === 0) {
          return res.status(400).json({ message: "No active products to include in stock take" });
        }

        const [take] = await db
          .insert(stockTakes)
          .values({
            societyId,
            notes: notes ?? null,
            createdBy: user.id,
          })
          .returning();

        await db.insert(stockTakeLines).values(
          productRows.map(p => ({
            stockTakeId: take.id,
            productId: p.id,
            systemStock: p.stock,
          }))
        );

        const linesOut = await db
          .select({
            line: stockTakeLines,
            productName: products.name,
            productUnit: products.unit,
          })
          .from(stockTakeLines)
          .innerJoin(products, eq(stockTakeLines.productId, products.id))
          .where(eq(stockTakeLines.stockTakeId, take.id));

        return res.status(201).json({
          ...take,
          lines: linesOut.map(({ line, productName, productUnit }) => ({
            ...line,
            productName,
            productUnit,
          })),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/stock-takes",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock takes not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const pq = paginatedQuerySchema.safeParse({
          page: req.query.page,
          limit: req.query.limit,
        });
        if (!pq.success) {
          return res.status(400).json({ message: "Invalid query", issues: pq.error.flatten() });
        }
        const { page, limit } = pq.data;
        const offset = (page - 1) * limit;

        const whereClause = eq(stockTakes.societyId, societyId);

        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(stockTakes)
          .where(whereClause);

        const total = countRow?.count ?? 0;

        const rows = await db
          .select()
          .from(stockTakes)
          .where(whereClause)
          .orderBy(desc(stockTakes.date))
          .limit(limit)
          .offset(offset);

        return res.status(200).json({ data: rows, total, page, limit });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/stock-takes/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock takes not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const { id } = req.params;

        const [take] = await db
          .select()
          .from(stockTakes)
          .where(and(eq(stockTakes.id, id), eq(stockTakes.societyId, societyId)))
          .limit(1);

        if (!take) {
          return res.status(404).json({ message: "Stock take not found" });
        }

        const lines = await db
          .select({
            line: stockTakeLines,
            productName: products.name,
            productUnit: products.unit,
          })
          .from(stockTakeLines)
          .innerJoin(products, eq(stockTakeLines.productId, products.id))
          .where(eq(stockTakeLines.stockTakeId, id));

        return res.status(200).json({
          ...take,
          lines: lines.map(({ line, productName, productUnit }) => ({
            ...line,
            productName,
            productUnit,
          })),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    "/api/stock-takes/:takeId/lines/:lineId",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock takes not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const { takeId, lineId } = req.params;

        const parsed = updateStockTakeLineSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid line payload",
            issues: parsed.error.flatten(),
          });
        }

        const [take] = await db
          .select()
          .from(stockTakes)
          .where(and(eq(stockTakes.id, takeId), eq(stockTakes.societyId, societyId)))
          .limit(1);

        if (!take) {
          return res.status(404).json({ message: "Stock take not found" });
        }

        if (take.status !== "draft") {
          return res.status(400).json({ message: "Stock take is not editable" });
        }

        const [lineRow] = await db
          .select()
          .from(stockTakeLines)
          .where(and(eq(stockTakeLines.id, lineId), eq(stockTakeLines.stockTakeId, takeId)))
          .limit(1);

        if (!lineRow) {
          return res.status(404).json({ message: "Line not found" });
        }

        const counted = parseInt(parsed.data.countedStock, 10);
        const system = parseInt(lineRow.systemStock, 10);
        const variance = String(counted - system);

        const [updated] = await db
          .update(stockTakeLines)
          .set({
            countedStock: parsed.data.countedStock,
            variance,
            notes: parsed.data.notes ?? lineRow.notes,
          })
          .where(eq(stockTakeLines.id, lineId))
          .returning();

        return res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/stock-takes/:id/finalize",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock takes not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const { id } = req.params;

        const [take] = await db
          .select()
          .from(stockTakes)
          .where(and(eq(stockTakes.id, id), eq(stockTakes.societyId, societyId)))
          .limit(1);

        if (!take) {
          return res.status(404).json({ message: "Stock take not found" });
        }

        if (take.status !== "draft") {
          return res.status(400).json({ message: "Stock take is not a draft" });
        }

        const lines = await db
          .select()
          .from(stockTakeLines)
          .where(eq(stockTakeLines.stockTakeId, id));

        const incomplete = lines.filter(l => l.countedStock == null || l.countedStock === "");
        if (incomplete.length > 0) {
          return res.status(400).json({
            message: "All lines must have a counted stock before finalizing",
            incompleteLineIds: incomplete.map(l => l.id),
          });
        }

        await db.transaction(async tx => {
          for (const line of lines) {
            const countedStock = line.countedStock!;
            const newQty = parseInt(countedStock, 10);

            const [pRow] = await tx
              .select()
              .from(products)
              .where(and(eq(products.id, line.productId), eq(products.societyId, societyId)))
              .limit(1);

            if (!pRow) {
              throw new Error("Product not found");
            }

            const prev = parseInt(pRow.stock, 10);
            if (Number.isNaN(prev) || Number.isNaN(newQty)) {
              throw new Error("Invalid stock values");
            }

            if (prev === newQty) {
              continue;
            }

            const delta = newQty - prev;

            await tx
              .update(products)
              .set({ stock: countedStock, updatedAt: new Date() })
              .where(and(eq(products.id, line.productId), eq(products.societyId, societyId)));

            await tx.insert(stockMovements).values({
              productId: line.productId,
              societyId,
              type: "adjustment",
              quantity: delta,
              reason: `Inbentarioa / Stock take ${take.id.slice(0, 8)}`,
              referenceId: take.id,
              previousStock: String(prev),
              newStock: countedStock,
              createdBy: user.id,
            });
          }

          await tx
            .update(stockTakes)
            .set({
              status: "completed",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(stockTakes.id, id));
        });

        const refreshedProducts = Array.from(new Set(lines.map(l => l.productId)));
        for (const productId of refreshedProducts) {
          await refreshLowStockNotificationForProduct(productId, societyId);
        }

        const [finalTake] = await db
          .select()
          .from(stockTakes)
          .where(eq(stockTakes.id, id))
          .limit(1);

        const linesOut = await db
          .select({
            line: stockTakeLines,
            productName: products.name,
            productUnit: products.unit,
          })
          .from(stockTakeLines)
          .innerJoin(products, eq(stockTakeLines.productId, products.id))
          .where(eq(stockTakeLines.stockTakeId, id));

        return res.status(200).json({
          ...finalTake,
          lines: linesOut.map(({ line, productName, productUnit }) => ({
            ...line,
            productName,
            productUnit,
          })),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/stock-takes/:id/cancel",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock takes not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const { id } = req.params;

        const [take] = await db
          .select()
          .from(stockTakes)
          .where(and(eq(stockTakes.id, id), eq(stockTakes.societyId, societyId)))
          .limit(1);

        if (!take) {
          return res.status(404).json({ message: "Stock take not found" });
        }

        if (take.status !== "draft") {
          return res.status(400).json({ message: "Only draft stock takes can be cancelled" });
        }

        const [updated] = await db
          .update(stockTakes)
          .set({
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(stockTakes.id, id))
          .returning();

        return res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );
}
