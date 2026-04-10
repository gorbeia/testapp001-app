import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import type { AppDatabase } from "../db";
import {
  products,
  productRecipeLines,
  insertProductSchema,
  updateProductCatalogSchema,
  replaceProductRecipeSchema,
  productPurposeSchema,
  type JwtSessionUser,
} from "@shared/schema";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canMutateProducts } from "@shared/permissions";
import { refreshLowStockNotificationForProduct } from "../lib/stock-notifications";
import { isValidStockString, parseStockNumber } from "../lib/inventory/stock-number";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

function normalizePurpose(value: string | null | undefined): "sale" | "internal" | "both" {
  const p = productPurposeSchema.safeParse(value);
  return p.success ? p.data : "sale";
}

async function countRecipeLinesForProduct(tx: AppDatabase, productId: string): Promise<number> {
  const rows = await tx
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(productRecipeLines)
    .where(eq(productRecipeLines.productId, productId));
  return rows[0]?.c ?? 0;
}

async function attachRecipeLineCounts<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { recipeLineCount: number }>> {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const countRows = await db
    .select({
      productId: productRecipeLines.productId,
      c: sql<number>`cast(count(*) as int)`,
    })
    .from(productRecipeLines)
    .where(inArray(productRecipeLines.productId, ids))
    .groupBy(productRecipeLines.productId);
  const map = new Map(countRows.map(r => [r.productId, r.c]));
  return rows.map(r => ({ ...r, recipeLineCount: map.get(r.id) ?? 0 }));
}

/** Error message or null if OK. */
async function validatePortionParent(
  tx: AppDatabase,
  societyId: string,
  productId: string | undefined,
  parentProductId: string | null,
  parentUnitsPerSale: string | null | undefined
): Promise<string | null> {
  if (!parentProductId) {
    if (parentUnitsPerSale != null && String(parentUnitsPerSale).trim() !== "") {
      return "parentUnitsPerSale must be empty when parentProductId is not set";
    }
    return null;
  }
  const units = parseFloat(parentUnitsPerSale ?? "");
  if (Number.isNaN(units) || units <= 0) {
    return "parentUnitsPerSale must be a positive number when parentProductId is set";
  }
  const [parent] = await tx
    .select()
    .from(products)
    .where(and(eq(products.id, parentProductId), eq(products.societyId, societyId)))
    .limit(1);
  if (!parent) {
    return "Parent product not found";
  }
  if (parent.parentProductId) {
    return "Parent cannot be a portion product (no chained portions)";
  }
  if (productId && parent.id === productId) {
    return "Product cannot be its own parent";
  }
  const parentRecipes = await countRecipeLinesForProduct(tx, parent.id);
  if (parentRecipes > 0) {
    return "Parent cannot be a composite product (has recipe lines)";
  }
  return null;
}

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
          if (!isValidStockString(p.stock) || !isValidStockString(p.minStock)) return false;
          const s = parseStockNumber(p.stock);
          const m = parseStockNumber(p.minStock);
          return s <= m;
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

  app.get(
    "/api/products",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const forPos =
          req.query.forPos === "true" || req.query.forPos === "1" || req.query.forPos === "yes";

        if (forPos) {
          const rows = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.societyId, societyId),
                or(eq(products.purpose, "sale"), eq(products.purpose, "both"))
              )
            );
          return res.status(200).json(await attachRecipeLineCounts(rows));
        }

        const allProducts = await db
          .select()
          .from(products)
          .where(eq(products.societyId, societyId));
        return res.status(200).json(await attachRecipeLineCounts(allProducts));
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/products/:id/recipe",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Product management not allowed" });
        }
        const societyId = getUserSocietyId(user);
        const { id } = req.params;

        const [product] = await db
          .select()
          .from(products)
          .where(and(eq(products.id, id), eq(products.societyId, societyId)))
          .limit(1);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        const lines = await db
          .select({
            line: productRecipeLines,
            ingredientName: products.name,
            ingredientUnit: products.unit,
          })
          .from(productRecipeLines)
          .innerJoin(products, eq(productRecipeLines.ingredientProductId, products.id))
          .where(eq(productRecipeLines.productId, id));

        return res.status(200).json({
          lines: lines.map(({ line, ingredientName, ingredientUnit }) => ({
            id: line.id,
            ingredientProductId: line.ingredientProductId,
            quantity: line.quantity,
            ingredientName,
            ingredientUnit,
          })),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.put(
    "/api/products/:id/recipe",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        if (!canMutateProducts(user)) {
          return res.status(403).json({ message: "Product management not allowed" });
        }
        const societyId = getUserSocietyId(user);
        const { id } = req.params;

        const parsed = replaceProductRecipeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid recipe payload",
            issues: parsed.error.flatten(),
          });
        }

        const [product] = await db
          .select()
          .from(products)
          .where(and(eq(products.id, id), eq(products.societyId, societyId)))
          .limit(1);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        if (product.parentProductId) {
          return res.status(400).json({
            message: "Cannot attach a recipe to a portion product",
          });
        }

        const ingredientIds = parsed.data.lines.map(l => l.ingredientProductId);
        if (ingredientIds.includes(id)) {
          return res.status(400).json({ message: "Recipe cannot reference the product itself" });
        }
        const uniqueIngredientIds = Array.from(new Set(ingredientIds));
        const ingredientRows = await db
          .select()
          .from(products)
          .where(and(eq(products.societyId, societyId), inArray(products.id, uniqueIngredientIds)));

        if (ingredientRows.length !== uniqueIngredientIds.length) {
          return res.status(400).json({ message: "One or more ingredients not found in society" });
        }

        for (const ing of ingredientRows) {
          if (ing.parentProductId) {
            return res.status(400).json({
              message: `Ingredient "${ing.name}" is a portion product; use the bulk SKU instead`,
            });
          }
          const nRecipes = await countRecipeLinesForProduct(db, ing.id);
          if (nRecipes > 0) {
            return res.status(400).json({
              message: `Ingredient "${ing.name}" is a composite product; nested recipes are not supported yet`,
            });
          }
        }

        await db.transaction(async tx => {
          await tx.delete(productRecipeLines).where(eq(productRecipeLines.productId, id));
          if (parsed.data.lines.length > 0) {
            await tx.insert(productRecipeLines).values(
              parsed.data.lines.map(l => ({
                productId: id,
                ingredientProductId: l.ingredientProductId,
                quantity: l.quantity,
              }))
            );
          }
        });

        const linesOut = await db
          .select({
            line: productRecipeLines,
            ingredientName: products.name,
            ingredientUnit: products.unit,
          })
          .from(productRecipeLines)
          .innerJoin(products, eq(productRecipeLines.ingredientProductId, products.id))
          .where(eq(productRecipeLines.productId, id));

        return res.status(200).json({
          lines: linesOut.map(({ line, ingredientName, ingredientUnit }) => ({
            id: line.id,
            ingredientProductId: line.ingredientProductId,
            quantity: line.quantity,
            ingredientName,
            ingredientUnit,
          })),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/products",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;

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
        const purpose = normalizePurpose(parsed.data.purpose ?? "sale");

        const portionErr = await validatePortionParent(
          db,
          societyId,
          undefined,
          parsed.data.parentProductId ?? null,
          parsed.data.parentUnitsPerSale ?? null
        );
        if (portionErr) {
          return res.status(400).json({ message: portionErr });
        }

        const [newProduct] = await db
          .insert(products)
          .values({
            ...parsed.data,
            purpose,
            parentProductId: parsed.data.parentProductId ?? null,
            parentUnitsPerSale: parsed.data.parentUnitsPerSale ?? null,
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

  app.put(
    "/api/products/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

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

        const [existing] = await db
          .select()
          .from(products)
          .where(and(eq(products.id, id), eq(products.societyId, societyId)))
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Product not found" });
        }

        const mergedParentId =
          parsed.data.parentProductId !== undefined
            ? parsed.data.parentProductId
            : existing.parentProductId;
        let mergedUnits =
          parsed.data.parentUnitsPerSale !== undefined
            ? parsed.data.parentUnitsPerSale
            : existing.parentUnitsPerSale;
        if (parsed.data.parentProductId === null) {
          mergedUnits = null;
        }
        const mergedPurpose = normalizePurpose(
          parsed.data.purpose !== undefined ? parsed.data.purpose : existing.purpose
        );

        const portionErr = await validatePortionParent(
          db,
          societyId,
          id,
          mergedParentId,
          mergedUnits ?? null
        );
        if (portionErr) {
          return res.status(400).json({ message: portionErr });
        }

        if (mergedParentId) {
          const recipes = await countRecipeLinesForProduct(db, id);
          if (recipes > 0) {
            return res.status(400).json({
              message: "Remove recipe lines before setting a parent product (portion link)",
            });
          }
        }

        const setPayload: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
        if (parsed.data.purpose !== undefined) {
          setPayload.purpose = mergedPurpose;
        }
        if (parsed.data.parentProductId !== undefined && parsed.data.parentProductId === null) {
          setPayload.parentUnitsPerSale = null;
        }

        const [updatedProduct] = await db
          .update(products)
          .set(setPayload as typeof parsed.data & { updatedAt: Date })
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

  app.delete(
    "/api/products/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

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
