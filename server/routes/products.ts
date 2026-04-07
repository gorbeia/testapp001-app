import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  products,
  insertProductSchema,
  updateProductCatalogSchema,
  type JwtSessionUser,
} from "@shared/schema";
import { and, eq, ne } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canMutateProducts } from "@shared/permissions";
import { refreshLowStockNotificationForProduct } from "../lib/stock-notifications";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerProductRoutes(app: Express) {
  app.get(
    "/api/products/low-stock-summary",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Product management not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const rows = await db
          .select({
            id: products.id,
            name: products.name,
            stock: products.stock,
            minStock: products.minStock,
            unit: products.unit,
          })
          .from(products)
          .where(and(eq(products.societyId, societyId), ne(products.stockMode, "none")));

        const low = rows.filter(p => {
          const s = parseInt(p.stock, 10);
          const m = parseInt(p.minStock, 10);
          return !Number.isNaN(s) && !Number.isNaN(m) && s <= m;
        });

        return res.status(200).json({
          count: low.length,
          products: low.slice(0, 25),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // Products: get all products
  app.get(
    "/api/products",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const allProducts = await db
          .select()
          .from(products)
          .where(eq(products.societyId, societyId));
        return res.status(200).json(allProducts);
      } catch (err) {
        next(err);
      }
    }
  );

  // Products: create new product (admin only)
  app.post(
    "/api/products",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;

        // Check if user is admin
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Product management not allowed" });
        }

        const parsed = insertProductSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid product payload", issues: parsed.error.flatten() });
        }

        const societyId = getUserSocietyId(user);

        const [newProduct] = await db
          .insert(products)
          .values({
            ...parsed.data,
            societyId,
          })
          .returning();

        await refreshLowStockNotificationForProduct(newProduct.id, societyId);

        return res.status(201).json(newProduct);
      } catch (err) {
        next(err);
      }
    }
  );

  // Products: update product (admin only)
  app.put(
    "/api/products/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        // Check if user is admin
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Product management not allowed" });
        }

        const societyId = getUserSocietyId(user);

        if (
          req.body != null &&
          typeof req.body === "object" &&
          Object.prototype.hasOwnProperty.call(req.body, "stock")
        ) {
          return res.status(400).json({
            message:
              "Stock cannot be updated here. Use POST /api/products/:id/adjust for audited changes.",
          });
        }

        const parsed = updateProductCatalogSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid product payload", issues: parsed.error.flatten() });
        }

        const [updatedProduct] = await db
          .update(products)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(and(eq(products.id, id), eq(products.societyId, societyId)))
          .returning();

        if (!updatedProduct) {
          return res.status(404).json({ message: "Product not found" });
        }

        await refreshLowStockNotificationForProduct(id, societyId);

        return res.status(200).json(updatedProduct);
      } catch (err) {
        next(err);
      }
    }
  );

  // Products: delete product (admin only)
  app.delete(
    "/api/products/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        // Check if user is admin
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Product management not allowed" });
        }

        const societyId = getUserSocietyId(user);
        const [deletedProduct] = await db
          .delete(products)
          .where(and(eq(products.id, id), eq(products.societyId, societyId)))
          .returning();

        if (!deletedProduct) {
          return res.status(404).json({ message: "Product not found" });
        }

        return res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );
}
