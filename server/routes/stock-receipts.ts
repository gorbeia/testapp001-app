import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  products,
  stockReceipts,
  stockReceiptLines,
  createStockReceiptSchema,
  paginatedQuerySchema,
  type JwtSessionUser,
} from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canMutateProducts } from "@shared/permissions";
import {
  applyStockDelta,
  refreshLowStockNotifications,
} from "../lib/inventory/inventory-service";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerStockReceiptRoutes(app: Express) {
  app.post(
    "/api/stock-receipts",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock receipts not allowed" });
        }

        const parsed = createStockReceiptSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid stock receipt payload",
            issues: parsed.error.flatten(),
          });
        }

        const societyId = getUserSocietyId(user);
        const { supplier, invoiceReference, notes, lines } = parsed.data;

        const productIds = Array.from(new Set(lines.map(l => l.productId)));
        const productRows = await db
          .select()
          .from(products)
          .where(and(eq(products.societyId, societyId), inArray(products.id, productIds)));

        if (productRows.length !== productIds.length) {
          return res.status(400).json({ message: "One or more products not found in society" });
        }

        const nonTracked = productRows.filter(p => (p.stockMode ?? "auto") === "none");
        if (nonTracked.length > 0) {
          return res.status(400).json({
            message: "Products without stock tracking cannot appear in receipts",
            productIds: nonTracked.map(p => p.id),
          });
        }

        const receiptId = await db.transaction(async tx => {
          const [receipt] = await tx
            .insert(stockReceipts)
            .values({
              societyId,
              supplier: supplier ?? null,
              invoiceReference: invoiceReference ?? null,
              notes: notes ?? null,
              createdBy: user.id,
            })
            .returning();

          for (const line of lines) {
            await tx.insert(stockReceiptLines).values({
              receiptId: receipt.id,
              productId: line.productId,
              quantity: line.quantity,
              unitCost: line.unitCost ?? null,
            });

            const reasonParts = ["Hornidura / Supply receipt", receipt.id.slice(0, 8)];
            if (invoiceReference) {
              reasonParts.push(`Ref: ${invoiceReference}`);
            }

            await applyStockDelta(tx, {
              productId: line.productId,
              societyId,
              delta: line.quantity,
              type: "purchase",
              reason: reasonParts.join(" · "),
              referenceId: receipt.id,
              createdBy: user.id,
            });
          }

          return receipt.id;
        });

        const touchedProducts = Array.from(new Set(lines.map(l => l.productId)));
        await refreshLowStockNotifications(touchedProducts, societyId);

        const [full] = await db
          .select()
          .from(stockReceipts)
          .where(and(eq(stockReceipts.id, receiptId), eq(stockReceipts.societyId, societyId)))
          .limit(1);

        const lineRows = await db
          .select()
          .from(stockReceiptLines)
          .where(eq(stockReceiptLines.receiptId, receiptId));

        return res.status(201).json({ ...full, lines: lineRows });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/stock-receipts",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock receipts not allowed" });
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

        const whereClause = eq(stockReceipts.societyId, societyId);

        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(stockReceipts)
          .where(whereClause);

        const total = countRow?.count ?? 0;

        const rows = await db
          .select()
          .from(stockReceipts)
          .where(whereClause)
          .orderBy(desc(stockReceipts.receivedAt))
          .limit(limit)
          .offset(offset);

        const ids = rows.map(r => r.id);
        let lineCounts: Record<string, number> = {};
        if (ids.length > 0) {
          const agg = await db
            .select({
              receiptId: stockReceiptLines.receiptId,
              c: sql<number>`count(*)::int`,
            })
            .from(stockReceiptLines)
            .where(inArray(stockReceiptLines.receiptId, ids))
            .groupBy(stockReceiptLines.receiptId);
          lineCounts = Object.fromEntries(agg.map(a => [a.receiptId, a.c]));
        }

        return res.status(200).json({
          data: rows.map(r => ({ ...r, lineCount: lineCounts[r.id] ?? 0 })),
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
    "/api/stock-receipts/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Stock receipts not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const { id } = req.params;

        const [receipt] = await db
          .select()
          .from(stockReceipts)
          .where(and(eq(stockReceipts.id, id), eq(stockReceipts.societyId, societyId)))
          .limit(1);

        if (!receipt) {
          return res.status(404).json({ message: "Receipt not found" });
        }

        const lines = await db
          .select({
            line: stockReceiptLines,
            productName: products.name,
            productUnit: products.unit,
          })
          .from(stockReceiptLines)
          .innerJoin(products, eq(stockReceiptLines.productId, products.id))
          .where(eq(stockReceiptLines.receiptId, id));

        return res.status(200).json({
          ...receipt,
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
}
