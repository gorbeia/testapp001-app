import { db } from "../db";
import { products, users } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notifyFinancialEvent } from "./financial-notifications";

/** Roles that manage inventory in this app and should receive low-stock alerts. */
const STOCK_ALERT_ROLES = ["admin", "cellarman"] as const;

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

    if ((row.stockMode ?? "auto") === "none") {
      if (row.lowStockNotified) {
        await db
          .update(products)
          .set({ lowStockNotified: false, updatedAt: new Date() })
          .where(and(eq(products.id, productId), eq(products.societyId, societyId)));
      }
      return;
    }

    const stock = parseInt(row.stock, 10);
    const minStock = parseInt(row.minStock, 10);
    const isLow =
      !Number.isNaN(stock) && !Number.isNaN(minStock) && stock <= minStock;

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
