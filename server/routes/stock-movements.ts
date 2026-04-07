import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  products,
  stockMovements,
  users,
  stockAdjustmentSchema,
  stockMovementListQuerySchema,
  type JwtSessionUser,
} from "@shared/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canMutateProducts } from "@shared/permissions";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerStockMovementRoutes(app: Express) {
  app.get(
    "/api/stock-movements",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock log not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const parsedQuery = stockMovementListQuerySchema.safeParse({
          productId: req.query.productId,
          type: req.query.type,
          from: req.query.from,
          to: req.query.to,
          page: req.query.page,
          limit: req.query.limit,
        });

        if (!parsedQuery.success) {
          return res.status(400).json({
            message: "Invalid query",
            issues: parsedQuery.error.flatten(),
          });
        }

        const { productId, type, from, to, page, limit } = parsedQuery.data;
        const offset = (page - 1) * limit;

        const conditions = [eq(stockMovements.societyId, societyId)];
        if (productId) {
          conditions.push(eq(stockMovements.productId, productId));
        }
        if (type) {
          conditions.push(eq(stockMovements.type, type));
        }
        if (from) {
          const fromDate = new Date(from);
          if (!Number.isNaN(fromDate.getTime())) {
            conditions.push(gte(stockMovements.createdAt, fromDate));
          }
        }
        if (to) {
          const toDate = new Date(to);
          if (!Number.isNaN(toDate.getTime())) {
            toDate.setHours(23, 59, 59, 999);
            conditions.push(lte(stockMovements.createdAt, toDate));
          }
        }

        const whereClause = and(...conditions);

        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(stockMovements)
          .where(whereClause);

        const total = countRow?.count ?? 0;

        const rows = await db
          .select({
            id: stockMovements.id,
            productId: stockMovements.productId,
            societyId: stockMovements.societyId,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            reason: stockMovements.reason,
            referenceId: stockMovements.referenceId,
            previousStock: stockMovements.previousStock,
            newStock: stockMovements.newStock,
            createdBy: stockMovements.createdBy,
            createdAt: stockMovements.createdAt,
            productName: products.name,
            createdByName: users.name,
          })
          .from(stockMovements)
          .leftJoin(
            products,
            and(eq(stockMovements.productId, products.id), eq(products.societyId, societyId))
          )
          .leftJoin(users, eq(stockMovements.createdBy, users.id))
          .where(whereClause)
          .orderBy(desc(stockMovements.createdAt))
          .limit(limit)
          .offset(offset);

        return res.status(200).json({
          data: rows,
          total,
          page,
          limit,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/products/:id/stock-movements",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock log not allowed" });
        }

        const { id: productId } = req.params;
        const societyId = getUserSocietyId(user);

        const productRow = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.id, productId), eq(products.societyId, societyId)))
          .limit(1);

        if (!productRow.length) {
          return res.status(404).json({ message: "Product not found" });
        }

        const parsedQuery = stockMovementListQuerySchema.safeParse({
          type: req.query.type,
          from: req.query.from,
          to: req.query.to,
          page: req.query.page,
          limit: req.query.limit,
        });

        if (!parsedQuery.success) {
          return res.status(400).json({
            message: "Invalid query",
            issues: parsedQuery.error.flatten(),
          });
        }

        const { type, from, to, page, limit } = parsedQuery.data;
        const offset = (page - 1) * limit;

        const conditions = [
          eq(stockMovements.societyId, societyId),
          eq(stockMovements.productId, productId),
        ];
        if (type) {
          conditions.push(eq(stockMovements.type, type));
        }
        if (from) {
          const fromDate = new Date(from);
          if (!Number.isNaN(fromDate.getTime())) {
            conditions.push(gte(stockMovements.createdAt, fromDate));
          }
        }
        if (to) {
          const toDate = new Date(to);
          if (!Number.isNaN(toDate.getTime())) {
            toDate.setHours(23, 59, 59, 999);
            conditions.push(lte(stockMovements.createdAt, toDate));
          }
        }

        const whereClause = and(...conditions);

        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(stockMovements)
          .where(whereClause);

        const total = countRow?.count ?? 0;

        const rows = await db
          .select({
            id: stockMovements.id,
            productId: stockMovements.productId,
            societyId: stockMovements.societyId,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            reason: stockMovements.reason,
            referenceId: stockMovements.referenceId,
            previousStock: stockMovements.previousStock,
            newStock: stockMovements.newStock,
            createdBy: stockMovements.createdBy,
            createdAt: stockMovements.createdAt,
            productName: products.name,
            createdByName: users.name,
          })
          .from(stockMovements)
          .leftJoin(
            products,
            and(eq(stockMovements.productId, products.id), eq(products.societyId, societyId))
          )
          .leftJoin(users, eq(stockMovements.createdBy, users.id))
          .where(whereClause)
          .orderBy(desc(stockMovements.createdAt))
          .limit(limit)
          .offset(offset);

        return res.status(200).json({
          data: rows,
          total,
          page,
          limit,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/products/:id/adjust",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock adjustment not allowed" });
        }

        const { id: productId } = req.params;
        const societyId = getUserSocietyId(user);

        const parsed = stockAdjustmentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid adjustment payload",
            issues: parsed.error.flatten(),
          });
        }

        const { type, quantity, reason } = parsed.data;

        const result = await db.transaction(async tx => {
          const [productRow] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, productId), eq(products.societyId, societyId)))
            .limit(1);

          if (!productRow) {
            return null;
          }

          const currentStock = parseInt(productRow.stock, 10);
          if (Number.isNaN(currentStock)) {
            throw new Error("Invalid product stock value");
          }

          const newStock = currentStock + quantity;

          await tx
            .update(products)
            .set({ stock: String(newStock), updatedAt: new Date() })
            .where(and(eq(products.id, productId), eq(products.societyId, societyId)));

          const [movement] = await tx
            .insert(stockMovements)
            .values({
              productId,
              societyId,
              type,
              quantity,
              reason,
              referenceId: null,
              previousStock: String(currentStock),
              newStock: String(newStock),
              createdBy: user.id,
            })
            .returning();

          return movement;
        });

        if (!result) {
          return res.status(404).json({ message: "Product not found" });
        }

        return res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );
}
