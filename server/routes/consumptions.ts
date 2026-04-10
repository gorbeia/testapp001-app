import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  consumptions,
  consumptionItems,
  products,
  users,
  addConsumptionItemsBodySchema,
  apiConsumptionCreateBodySchema,
  type JwtSessionUser,
} from "@shared/schema";
import { eq, and, gte, desc, count, sql, or, between, ilike, isNull } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { canModerateConsumptions } from "@shared/permissions";
import { debtCalculationService } from "../cron-jobs";
import { devLog } from "../lib/dev-log";
import { postConsumptionDebit } from "../lib/ledger/ledger-service";
import {
  assertPrepaymentDebitAllowed,
  notifyIfCrossedPrepaymentFloor,
  prepaymentFloorHttpBody,
} from "../lib/prepayment-ledger-floor";
import {
  InventoryServiceError,
  postConsumptionStockDecrements,
} from "../lib/inventory/inventory-service";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

function parseConsumptionListPagination(req: Request): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

export function registerConsumptionRoutes(app: Express) {
  // Consumptions: create new consumption session
  app.post(
    "/api/consumptions",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const parsed = apiConsumptionCreateBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid consumption payload",
            issues: parsed.error.flatten(),
          });
        }

        const prepaymentCheckCreate = await assertPrepaymentDebitAllowed(societyId, user.id, 0);
        if (!prepaymentCheckCreate.allowed) {
          return res.status(403).json(prepaymentFloorHttpBody(prepaymentCheckCreate));
        }

        const consumptionData = {
          ...parsed.data,
          userId: user.id,
          societyId,
        };

        const [newConsumption] = await db.insert(consumptions).values(consumptionData).returning();

        // Trigger real-time debt calculation for current month
        devLog(`[CONSUMPTION-CREATED] Triggering debt calculation for user ${user.id}`);
        await debtCalculationService.calculateCurrentMonthDebtsForSociety(societyId);

        return res.status(201).json(newConsumption);
      } catch (err) {
        next(err);
      }
    }
  );

  // Consumptions: get user's own consumptions with filtering
  app.get(
    "/api/consumptions/user",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const { search, month } = req.query;
        const societyId = getUserSocietyId(user);

        const conditions = [
          eq(consumptions.userId, user.id),
          eq(consumptions.societyId, societyId),
        ];

        // Add month filter
        if (month && month !== "all") {
          conditions.push(sql`EXTRACT(MONTH FROM ${consumptions.createdAt}) = ${month}`);
        }

        // Add search filter (search by notes or date)
        if (search) {
          const searchTerm = `%${String(search).replace(/%/g, "\\%")}%`;
          const searchCondition = or(
            ilike(consumptions.notes, searchTerm),
            ilike(consumptions.createdAt, searchTerm),
            ilike(sql<string>`cast(${consumptions.id} as text)`, searchTerm)
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

        const { limit, offset } = parseConsumptionListPagination(req);

        const whereClause = and(...conditions);

        const [totalRow] = await db.select({ c: count() }).from(consumptions).where(whereClause);
        const total = Number(totalRow?.c ?? 0);

        const [sumRow] = await db
          .select({
            s: sql<string>`coalesce(sum(${consumptions.totalAmount}::numeric), 0)::text`,
          })
          .from(consumptions)
          .where(whereClause);

        const [pendingRow] = await db
          .select({ c: count() })
          .from(consumptions)
          .where(and(whereClause, isNull(consumptions.closedAt)));

        const userConsumptions = await db
          .select({
            id: consumptions.id,
            userId: consumptions.userId,
            eventId: consumptions.eventId,
            totalAmount: consumptions.totalAmount,
            notes: consumptions.notes,
            createdAt: consumptions.createdAt,
            closedAt: consumptions.closedAt,
            closedBy: consumptions.closedBy,
          })
          .from(consumptions)
          .where(whereClause)
          .orderBy(desc(consumptions.createdAt))
          .limit(limit)
          .offset(offset);

        res.json({
          data: userConsumptions,
          total,
          sumTotalAmount: parseFloat(String(sumRow?.s ?? "0")),
          pendingCount: Number(pendingRow?.c ?? 0),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Consumptions: get all consumptions (admin) or user's consumptions with filtering
  app.get(
    "/api/consumptions",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const { userId: filterUserId, month: filterMonth, search: searchRaw } = req.query;
        const societyId = getUserSocietyId(user);

        // Build base conditions
        const baseConditions = [eq(consumptions.societyId, societyId)];

        // Add user filter (only admins can filter by user)
        if (filterUserId && canModerateConsumptions(user.accessRole)) {
          baseConditions.push(eq(consumptions.userId, filterUserId as string));
        }

        // Add month filter (YYYY-MM format)
        if (filterMonth) {
          const year = parseInt((filterMonth as string).substring(0, 4));
          const month = parseInt((filterMonth as string).substring(5, 7));

          if (!isNaN(year) && !isNaN(month)) {
            const startDate = new Date(year, month - 1, 1); // First day of month
            const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
            baseConditions.push(between(consumptions.createdAt, startDate, endDate));
          }
        }

        if (searchRaw && String(searchRaw).trim()) {
          const term = `%${String(searchRaw).replace(/%/g, "\\%").trim()}%`;
          const searchCondition = or(
            ilike(consumptions.notes, term),
            ilike(sql<string>`cast(${consumptions.id} as text)`, term)
          );
          if (searchCondition) {
            baseConditions.push(searchCondition);
          }
        }

        if (!canModerateConsumptions(user.accessRole)) {
          baseConditions.push(eq(consumptions.userId, user.id));
        }

        const whereClause = and(...baseConditions);
        const { limit, offset } = parseConsumptionListPagination(req);

        const [totalRow] = await db.select({ c: count() }).from(consumptions).where(whereClause);
        const total = Number(totalRow?.c ?? 0);

        const allConsumptions = await db
          .select({
            id: consumptions.id,
            userId: consumptions.userId,
            userName: users.name,
            userUsername: users.username,
            eventId: consumptions.eventId,
            totalAmount: consumptions.totalAmount,
            notes: consumptions.notes,
            createdAt: consumptions.createdAt,
            closedAt: consumptions.closedAt,
            closedBy: consumptions.closedBy,
          })
          .from(consumptions)
          .leftJoin(users, eq(consumptions.userId, users.id))
          .where(whereClause)
          .orderBy(desc(consumptions.createdAt))
          .limit(limit)
          .offset(offset);

        return res.status(200).json({ data: allConsumptions, total });
      } catch (err) {
        next(err);
      }
    }
  );

  // Consumption statistics for dashboard
  app.get(
    "/api/consumptions/count",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { startDate } = req.query;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const conditions = [eq(consumptions.societyId, societyId)];

        if (startDate) {
          conditions.push(gte(consumptions.createdAt, new Date(startDate as string)));
        }

        const result = await db
          .select({
            count: count(),
          })
          .from(consumptions)
          .where(and(...conditions));

        res.json({ count: result[0]?.count || 0 });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/consumptions/sum",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { startDate } = req.query;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const conditions = [eq(consumptions.societyId, societyId)];

        if (startDate) {
          conditions.push(gte(consumptions.createdAt, new Date(startDate as string)));
        }

        // Get all consumption items that match the date criteria
        const consumptionItemsQuery = db
          .select({
            consumptionId: consumptionItems.consumptionId,
            quantity: consumptionItems.quantity,
            unitPrice: consumptionItems.unitPrice,
          })
          .from(consumptionItems)
          .innerJoin(consumptions, eq(consumptionItems.consumptionId, consumptions.id))
          .where(and(...conditions));

        const items = await consumptionItemsQuery;

        // Calculate total sum
        const totalSum = items.reduce((sum, item) => {
          return sum + parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice || "0");
        }, 0);

        res.json({ sum: totalSum });
      } catch (error) {
        next(error);
      }
    }
  );

  // Member consumption statistics for dashboard
  app.get(
    "/api/consumptions/member/sum",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { startDate } = req.query;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const conditions = [
          eq(consumptions.societyId, societyId),
          eq(consumptions.userId, user.id),
        ];

        if (startDate) {
          conditions.push(gte(consumptions.createdAt, new Date(startDate as string)));
        }

        // Get all consumption items that match the date criteria for this member
        const consumptionItemsQuery = db
          .select({
            consumptionId: consumptionItems.consumptionId,
            quantity: consumptionItems.quantity,
            unitPrice: consumptionItems.unitPrice,
          })
          .from(consumptionItems)
          .innerJoin(consumptions, eq(consumptionItems.consumptionId, consumptions.id))
          .where(and(...conditions));

        const items = await consumptionItemsQuery;

        // Calculate total sum
        const totalSum = items.reduce((sum, item) => {
          return sum + parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice || "0");
        }, 0);

        res.json({ sum: totalSum });
      } catch (error) {
        next(error);
      }
    }
  );

  // Consumptions: get consumption by ID with items
  app.get(
    "/api/consumptions/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        // Get consumption with user info
        const societyId = getUserSocietyId(user);
        const consumptionData = await db
          .select({
            id: consumptions.id,
            userId: consumptions.userId,
            userName: users.name,
            userUsername: users.username,
            eventId: consumptions.eventId,
            totalAmount: consumptions.totalAmount,
            notes: consumptions.notes,
            createdAt: consumptions.createdAt,
            closedAt: consumptions.closedAt,
            closedBy: consumptions.closedBy,
          })
          .from(consumptions)
          .leftJoin(users, eq(consumptions.userId, users.id))
          .where(and(eq(consumptions.id, id), eq(consumptions.societyId, societyId)))
          .limit(1);

        if (!consumptionData.length) {
          return res.status(404).json({ message: "Consumption not found" });
        }

        const consumption = consumptionData[0];

        // Check permissions
        if (consumption.userId !== user.id && !canModerateConsumptions(user.accessRole)) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Get consumption items with product info
        const items = await db
          .select({
            id: consumptionItems.id,
            consumptionId: consumptionItems.consumptionId,
            productId: consumptionItems.productId,
            productName: products.name,
            quantity: consumptionItems.quantity,
            unitPrice: consumptionItems.unitPrice,
            totalPrice: consumptionItems.totalPrice,
            notes: consumptionItems.notes,
            createdAt: consumptionItems.createdAt,
          })
          .from(consumptionItems)
          .leftJoin(products, eq(consumptionItems.productId, products.id))
          .where(eq(consumptionItems.consumptionId, id));

        return res.status(200).json({ consumption, items });
      } catch (err) {
        next(err);
      }
    }
  );

  // Consumption Items: get items for a consumption
  app.get(
    "/api/consumptions/:id/items",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        // Verify user has access to this consumption
        const consumption = await db
          .select()
          .from(consumptions)
          .where(
            and(
              eq(consumptions.id, id),
              eq(consumptions.societyId, societyId),
              canModerateConsumptions(user.accessRole)
                ? undefined
                : eq(consumptions.userId, user.id)
            )
          )
          .limit(1);

        if (consumption.length === 0) {
          return res.status(404).json({ message: "Consumption not found or access denied" });
        }

        const items = await db
          .select({
            id: consumptionItems.id,
            consumptionId: consumptionItems.consumptionId,
            productId: consumptionItems.productId,
            quantity: consumptionItems.quantity,
            unitPrice: consumptionItems.unitPrice,
            totalPrice: consumptionItems.totalPrice,
            notes: consumptionItems.notes,
            productName: products.name,
          })
          .from(consumptionItems)
          .leftJoin(products, eq(consumptionItems.productId, products.id))
          .where(eq(consumptionItems.consumptionId, id));

        res.json(items);
      } catch (error) {
        next(error);
      }
    }
  );

  // Consumption Items: add items to consumption
  app.post(
    "/api/consumptions/:id/items",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        const parsedItems = addConsumptionItemsBodySchema.safeParse(req.body);
        if (!parsedItems.success) {
          return res.status(400).json({
            message: "Invalid items payload",
            issues: parsedItems.error.flatten(),
          });
        }

        const { items } = parsedItems.data;

        // Verify consumption exists and user has access
        const societyId = getUserSocietyId(user);
        const consumption = await db
          .select()
          .from(consumptions)
          .where(and(eq(consumptions.id, id), eq(consumptions.societyId, societyId)))
          .limit(1);

        if (!consumption.length) {
          return res.status(404).json({ message: "Consumption not found" });
        }

        if (consumption[0].userId !== user.id && !canModerateConsumptions(user.accessRole)) {
          return res.status(403).json({ message: "Access denied" });
        }

        if (consumption[0].closedAt !== null) {
          return res.status(400).json({ message: "Consumption is closed" });
        }

        let debitTotal = 0;
        for (const item of items) {
          const productRow = await db
            .select()
            .from(products)
            .where(and(eq(products.id, item.productId), eq(products.societyId, societyId)))
            .limit(1);
          if (!productRow.length) {
            return res.status(404).json({ message: `Product ${item.productId} not found` });
          }
          const unitPrice = parseFloat(productRow[0].price);
          debitTotal += unitPrice * item.quantity;
        }

        const billedUserId = consumption[0].userId;
        const prepaymentCheckItems = await assertPrepaymentDebitAllowed(
          societyId,
          billedUserId,
          debitTotal
        );
        if (!prepaymentCheckItems.allowed) {
          return res.status(403).json(prepaymentFloorHttpBody(prepaymentCheckItems));
        }

        const addedItems = [];
        let totalAmount = parseFloat(consumption[0].totalAmount || "0");

        for (const item of items) {
          // Get product info
          const product = await db
            .select()
            .from(products)
            .where(and(eq(products.id, item.productId), eq(products.societyId, societyId)))
            .limit(1);

          if (!product.length) {
            return res.status(404).json({ message: `Product ${item.productId} not found` });
          }

          const unitPrice = parseFloat(product[0].price);
          const totalPrice = unitPrice * item.quantity;

          // Create consumption item
          const [newItem] = await db
            .insert(consumptionItems)
            .values({
              consumptionId: id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: unitPrice.toString(),
              totalPrice: totalPrice.toString(),
              notes: item.notes || null,
            })
            .returning();

          addedItems.push(newItem);
          totalAmount += totalPrice;

          await postConsumptionDebit({
            societyId,
            userId: consumption[0].userId,
            totalPrice,
            description: product[0].name
              ? `Consumption: ${product[0].name} x${item.quantity}`
              : "Consumption line",
            referenceId: newItem.id,
            createdBy: user.id,
          });

          try {
            await postConsumptionStockDecrements(db, {
              productId: item.productId,
              societyId,
              saleQty: item.quantity,
              referenceId: id,
              createdBy: user.id,
            });
          } catch (e) {
            if (e instanceof InventoryServiceError) {
              if (e.code === "PRODUCT_NOT_FOUND") {
                return res.status(404).json({ message: e.message });
              }
              if (e.code === "INVALID_STOCK") {
                return res.status(400).json({ message: e.message });
              }
            }
            throw e;
          }
        }

        // Update consumption total
        await db
          .update(consumptions)
          .set({ totalAmount: totalAmount.toString() })
          .where(eq(consumptions.id, id));

        // Trigger real-time debt calculation for current month
        devLog(
          `[CONSUMPTION-ITEMS-ADDED] Triggering debt calculation for user ${user.id}, total: ${totalAmount}`
        );
        await debtCalculationService.calculateCurrentMonthDebtsForSociety(societyId);

        if (debitTotal > 0) {
          try {
            await notifyIfCrossedPrepaymentFloor({
              societyId,
              userId: billedUserId,
              balanceBefore: prepaymentCheckItems.balanceBefore,
              debitTotal,
            });
          } catch (e) {
            console.error("Prepayment floor notification failed:", e);
          }
        }

        return res.status(201).json({ items: addedItems, totalAmount: totalAmount.toString() });
      } catch (err) {
        next(err);
      }
    }
  );

  // Consumptions: close consumption
  app.post(
    "/api/consumptions/:id/close",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        const societyId = getUserSocietyId(user);
        const consumption = await db
          .select()
          .from(consumptions)
          .where(and(eq(consumptions.id, id), eq(consumptions.societyId, societyId)))
          .limit(1);

        if (!consumption.length) {
          return res.status(404).json({ message: "Consumption not found" });
        }

        if (consumption[0].userId !== user.id && !canModerateConsumptions(user.accessRole)) {
          return res.status(403).json({ message: "Access denied" });
        }

        if (consumption[0].closedAt !== null) {
          return res.status(400).json({ message: "Consumption already closed" });
        }

        const [updatedConsumption] = await db
          .update(consumptions)
          .set({
            closedAt: new Date(),
            closedBy: user.id,
          })
          .where(eq(consumptions.id, id))
          .returning();

        return res.status(200).json(updatedConsumption);
      } catch (err) {
        next(err);
      }
    }
  );
}
