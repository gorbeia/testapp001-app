import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  products,
  insertProductSchema,
  updateProductSchema,
  type JwtSessionUser,
} from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canMutateProducts } from "@shared/permissions";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerProductRoutes(app: Express) {
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
        const parsed = updateProductSchema.safeParse(req.body);
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
