import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { products, type User, type Product } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

// Helper function to check if user is admin
const requireAdminAccess = (user: User): boolean => {
  return user.role === 'bazkidea' && user.function === 'administratzailea';
};

export function registerProductRoutes(app: Express) {
  // Products: get all products
  app.get("/api/products", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const allProducts = await db.select().from(products).where(eq(products.societyId, societyId));
      return res.status(200).json(allProducts);
    } catch (err) {
      next(err);
    }
  });

  // Products: create new product (admin only)
  app.post("/api/products", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      
      // Check if user is admin
      if (!requireAdminAccess(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const productData = req.body;
      const societyId = getUserSocietyId(user);
      
      // Auto-assign the user's society ID
      const [newProduct] = await db.insert(products).values({
        ...productData,
        societyId,
      }).returning();
      
      return res.status(201).json(newProduct);
    } catch (err) {
      next(err);
    }
  });

  // Products: update product (admin only)
  app.put("/api/products/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Check if user is admin
      if (!requireAdminAccess(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updateData = req.body;
      const [updatedProduct] = await db
        .update(products)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(200).json(updatedProduct);
    } catch (err) {
      next(err);
    }
  });

  // Products: delete product (admin only)
  app.delete("/api/products/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Check if user is admin
      if (!requireAdminAccess(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const [deletedProduct] = await db
        .delete(products)
        .where(eq(products.id, id))
        .returning();
      
      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
}
