import { db, type AppDatabase } from "../../db";
import { products, productRecipeLines, stockMovements, users } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notifyFinancialEvent } from "../financial-notifications";
import { formatStockNumber, isValidStockString, parseStockNumber } from "./stock-number";

/** Posted row from stock_movements insert. */
export type StockMovementRow = typeof stockMovements.$inferSelect;

export type StockMovementType = "consumption" | "purchase" | "adjustment" | "damage";

/** Roles that manage inventory in this app and should receive low-stock alerts. */
const STOCK_ALERT_ROLES = ["admin", "cellarman"] as const;

export type InventoryServiceErrorCode = "PRODUCT_NOT_FOUND" | "STOCK_MODE_NONE" | "INVALID_STOCK";

export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public readonly code: InventoryServiceErrorCode
  ) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

export function normalizeStockMode(
  stockMode: string | null | undefined
): "auto" | "manual" | "none" {
  const m = stockMode ?? "auto";
  if (m === "manual" || m === "none") return m;
  return "auto";
}

/** False when `stock_mode` is `none` (no inventory). */
export function isStockTracked(product: { stockMode?: string | null }): boolean {
  return normalizeStockMode(product.stockMode) !== "none";
}

/** True when POS consumption should decrement stock (`auto` only). */
export function shouldAutoDecrement(product: { stockMode?: string | null }): boolean {
  return normalizeStockMode(product.stockMode) === "auto";
}

export interface ApplyStockDeltaParams {
  productId: string;
  societyId: string;
  /** Added to current parsed stock (may be negative or fractional). */
  delta: number;
  type: StockMovementType;
  reason: string;
  referenceId: string | null;
  createdBy: string;
  /**
   * When set, written to `products.stock` and `stock_movements.new_stock`
   * (e.g. stock take counted string). Otherwise `current + delta`.
   */
  newStockOverride?: string;
}

/**
 * Read product, validate stock mode, apply delta, insert `stock_movements`.
 * Call inside `db.transaction` or on `db` for non-transactional flows (e.g. consumptions).
 */
export async function applyStockDelta(
  dbOrTx: AppDatabase,
  params: ApplyStockDeltaParams
): Promise<StockMovementRow> {
  const { productId, societyId, delta, type, reason, referenceId, createdBy, newStockOverride } =
    params;

  const [productRow] = await dbOrTx
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.societyId, societyId)))
    .limit(1);

  if (!productRow) {
    throw new InventoryServiceError("Product not found", "PRODUCT_NOT_FOUND");
  }

  if (normalizeStockMode(productRow.stockMode) === "none") {
    throw new InventoryServiceError(
      "Stock changes are not allowed for products without inventory tracking",
      "STOCK_MODE_NONE"
    );
  }

  if (!isValidStockString(productRow.stock)) {
    throw new InventoryServiceError("Invalid product stock value", "INVALID_STOCK");
  }
  const currentStock = parseStockNumber(productRow.stock);

  let newStockStr: string;
  if (newStockOverride != null) {
    if (!isValidStockString(newStockOverride)) {
      throw new InventoryServiceError("Invalid product stock value", "INVALID_STOCK");
    }
    newStockStr = formatStockNumber(parseStockNumber(newStockOverride));
  } else {
    newStockStr = formatStockNumber(currentStock + delta);
  }

  await dbOrTx
    .update(products)
    .set({ stock: newStockStr, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.societyId, societyId)));

  const [movement] = await dbOrTx
    .insert(stockMovements)
    .values({
      productId,
      societyId,
      type,
      quantity: formatStockNumber(delta),
      reason,
      referenceId,
      previousStock: formatStockNumber(currentStock),
      newStock: newStockStr,
      createdBy,
    })
    .returning();

  if (!movement) {
    throw new Error("Failed to insert stock movement");
  }

  return movement;
}

/**
 * After any stock or threshold-relevant change, reconcile low-stock state:
 * if stock <= minStock and not yet notified → notify staff (full-member admin/cellarman) and set flag;
 * if stock > minStock → clear flag (so a future dip can notify again).
 */
export async function refreshLowStockNotificationForProduct(
  productId: string,
  societyId: string
): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.societyId, societyId)))
      .limit(1);

    if (!row) return;

    if (normalizeStockMode(row.stockMode) === "none") {
      if (row.lowStockNotified) {
        await db
          .update(products)
          .set({ lowStockNotified: false, updatedAt: new Date() })
          .where(and(eq(products.id, productId), eq(products.societyId, societyId)));
      }
      return;
    }

    const stock = parseStockNumber(row.stock);
    const minStock = parseStockNumber(row.minStock);
    const isLow =
      Number.isFinite(stock) &&
      Number.isFinite(minStock) &&
      isValidStockString(row.stock) &&
      isValidStockString(row.minStock) &&
      stock <= minStock;

    if (!isLow) {
      if (row.lowStockNotified) {
        await db
          .update(products)
          .set({ lowStockNotified: false, updatedAt: new Date() })
          .where(and(eq(products.id, productId), eq(products.societyId, societyId)));
      }
      return;
    }

    if (row.lowStockNotified) {
      return;
    }

    const targets = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.societyId, societyId),
          eq(users.isActive, true),
          eq(users.membershipType, "full_member"),
          inArray(users.accessRole, [...STOCK_ALERT_ROLES])
        )
      );

    for (const t of targets) {
      await notifyFinancialEvent({
        userId: t.id,
        societyId,
        referenceId: productId,
        titleKey: "stockLowAlertTitle",
        messageKey: "stockLowAlertMessage",
        params: {
          productName: row.name,
          newStock: stock,
          unit: row.unit,
          minStock,
        },
      });
    }

    await db
      .update(products)
      .set({ lowStockNotified: true, updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.societyId, societyId)));
  } catch (e) {
    console.error("Low stock notification failed:", e);
  }
}

export async function refreshLowStockNotifications(
  productIds: string[],
  societyId: string
): Promise<void> {
  const unique = Array.from(new Set(productIds));
  await Promise.all(unique.map(id => refreshLowStockNotificationForProduct(id, societyId)));
}

/**
 * Apply inventory decrements for a consumption line: recipe ingredients, parent bulk for portions, or the product itself.
 */
export async function postConsumptionStockDecrements(
  dbOrTx: AppDatabase,
  params: {
    productId: string;
    societyId: string;
    saleQty: number;
    referenceId: string;
    createdBy: string;
  }
): Promise<void> {
  const { productId, societyId, saleQty, referenceId, createdBy } = params;

  const [productRow] = await dbOrTx
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.societyId, societyId)))
    .limit(1);

  if (!productRow) {
    throw new InventoryServiceError("Product not found", "PRODUCT_NOT_FOUND");
  }

  const recipeLines = await dbOrTx
    .select()
    .from(productRecipeLines)
    .where(eq(productRecipeLines.productId, productId));

  if (recipeLines.length > 0) {
    for (const line of recipeLines) {
      const lineQty = parseFloat(line.quantity);
      if (Number.isNaN(lineQty) || lineQty < 0) {
        throw new InventoryServiceError("Invalid recipe line quantity", "INVALID_STOCK");
      }
      const [ing] = await dbOrTx
        .select()
        .from(products)
        .where(
          and(eq(products.id, line.ingredientProductId), eq(products.societyId, societyId))
        )
        .limit(1);
      if (!ing) {
        throw new InventoryServiceError("Product not found", "PRODUCT_NOT_FOUND");
      }
      if (shouldAutoDecrement(ing)) {
        await applyStockDelta(dbOrTx, {
          productId: ing.id,
          societyId,
          delta: -saleQty * lineQty,
          type: "consumption",
          reason: "Bar consumption (recipe)",
          referenceId,
          createdBy,
        });
        await refreshLowStockNotificationForProduct(ing.id, societyId);
      }
    }
    return;
  }

  if (productRow.parentProductId) {
    const parentUnits = parseFloat(productRow.parentUnitsPerSale ?? "");
    if (Number.isNaN(parentUnits) || parentUnits <= 0) {
      return;
    }
    const [parent] = await dbOrTx
      .select()
      .from(products)
      .where(
        and(eq(products.id, productRow.parentProductId), eq(products.societyId, societyId))
      )
      .limit(1);
    if (!parent) {
      throw new InventoryServiceError("Product not found", "PRODUCT_NOT_FOUND");
    }
    if (shouldAutoDecrement(parent)) {
      await applyStockDelta(dbOrTx, {
        productId: parent.id,
        societyId,
        delta: -saleQty * parentUnits,
        type: "consumption",
        reason: "Bar consumption (portion)",
        referenceId,
        createdBy,
      });
      await refreshLowStockNotificationForProduct(parent.id, societyId);
    }
    return;
  }

  if (shouldAutoDecrement(productRow)) {
    await applyStockDelta(dbOrTx, {
      productId,
      societyId,
      delta: -saleQty,
      type: "consumption",
      reason: "Bar consumption",
      referenceId,
      createdBy,
    });
    await refreshLowStockNotificationForProduct(productId, societyId);
  }
}
