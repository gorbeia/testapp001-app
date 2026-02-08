import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  consumptions,
  consumptionItems,
  products,
  users,
  stockMovements,
  type User,
} from "@shared/schema";
import { eq, and, gte, desc, count, sql, like, or, between } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { debtCalculationService } from "../cron-jobs";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

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
        const consumptionData = {
          ...req.body,
          userId: user.id,
          societyId,
        };

        const [newConsumption] = await db.insert(consumptions).values(consumptionData).returning();

        // Trigger real-time debt calculation for current month
        console.log(`[CONSUMPTION-CREATED] Triggering debt calculation for user ${user.id}`);
        await debtCalculationService.calculateCurrentMonthDebts();

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

        const conditions = [eq(consumptions.userId, user.id), eq(consumptions.societyId, societyId)];

        // Add month filter
        if (month && month !== "all") {
          conditions.push(sql`EXTRACT(MONTH FROM ${consumptions.createdAt}) = ${month}`);
        }

        // Add search filter (search by notes or date)
        if (search) {
          const searchTerm = `%${search}%`;
          const searchCondition = or(
            like(consumptions.notes, searchTerm),
            like(consumptions.createdAt, searchTerm)
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

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
          .where(and(...conditions))
          .orderBy(desc(consumptions.createdAt));

        res.json(userConsumptions);
      } catch (error) {
        console.error("Error fetching user consumptions:", error);
        res.status(500).json({ message: "Internal server error" });
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
        const { userId: filterUserId, month: filterMonth } = req.query;
        const societyId = getUserSocietyId(user);

        // Build base conditions
        const baseConditions = [eq(consumptions.societyId, societyId)];

        // Add user filter (only admins can filter by user)
        if (
          filterUserId &&
          ["administratzailea", "diruzaina", "sotolaria"].includes(user.function || "")
        ) {
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

        let allConsumptions;
        if (["administratzailea", "diruzaina", "sotolaria"].includes(user.function || "")) {
          // Admin can see all consumptions with user names
          allConsumptions = await db
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
            .where(and(...baseConditions))
            .orderBy(desc(consumptions.createdAt));
        } else {
          // Regular users can only see their own consumptions
          baseConditions.push(eq(consumptions.userId, user.id));
          allConsumptions = await db
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
            .where(and(...baseConditions))
            .orderBy(desc(consumptions.createdAt));
        }

        return res.status(200).json(allConsumptions);
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
        if (
          consumption.userId !== user.id &&
          !["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "")
        ) {
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
              ["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "")
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
        console.error("Error fetching consumption items:", error);
        res.status(500).json({ message: "Internal server error" });
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
        const { items } = req.body; // Array of { productId, quantity, notes }

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

        if (
          consumption[0].userId !== user.id &&
          !["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "")
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        if (consumption[0].closedAt !== null) {
          return res.status(400).json({ message: "Consumption is closed" });
        }

        const addedItems = [];
        let totalAmount = parseFloat(consumption[0].totalAmount || "0");

        for (const item of items) {
          // Get product info
          const product = await db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
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

          // Update product stock
          const currentStock = parseInt(product[0].stock);
          const newStock = currentStock - item.quantity;

          // Allow negative stocks since consumption represents actual usage
          await db
            .update(products)
            .set({ stock: newStock.toString(), updatedAt: new Date() })
            .where(eq(products.id, item.productId));

          // Create stock movement
          const societyId = getUserSocietyId(user);
          await db.insert(stockMovements).values({
            productId: item.productId,
            societyId,
            type: "consumption",
            quantity: -item.quantity,
            reason: "Bar consumption",
            referenceId: id,
            previousStock: currentStock.toString(),
            newStock: newStock.toString(),
            createdBy: user.id,
          });
        }

        // Update consumption total
        await db
          .update(consumptions)
          .set({ totalAmount: totalAmount.toString() })
          .where(eq(consumptions.id, id));

        // Trigger real-time debt calculation for current month
        console.log(
          `[CONSUMPTION-ITEMS-ADDED] Triggering debt calculation for user ${user.id}, total: ${totalAmount}`
        );
        await debtCalculationService.calculateCurrentMonthDebts();

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

        if (
          consumption[0].userId !== user.id &&
          !["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "")
        ) {
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
