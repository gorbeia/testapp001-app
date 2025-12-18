import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { subscriptionTypes, type SubscriptionType } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./middleware";

// Helper function to get society ID from user
const getUserSocietyId = (user: any): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found');
  }
  return user.societyId;
};

export function registerSubscriptionRoutes(app: Express) {
  // Get all subscription types for the user's society
  app.get("/api/subscription-types", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const societyId = getUserSocietyId(user);

      const subscriptionTypesData = await db
        .select()
        .from(subscriptionTypes)
        .where(eq(subscriptionTypes.societyId, societyId))
        .orderBy(subscriptionTypes.createdAt);

      res.json(subscriptionTypesData);
    } catch (error) {
      next(error);
    }
  });

  // Get a specific subscription type
  app.get("/api/subscription-types/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const societyId = getUserSocietyId(user);

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: "Invalid subscription type ID" });
      }

      const subscriptionType = await db
        .select()
        .from(subscriptionTypes)
        .where(and(eq(subscriptionTypes.id, id), eq(subscriptionTypes.societyId, societyId)))
        .limit(1);

      if (subscriptionType.length === 0) {
        return res.status(404).json({ message: "Subscription type not found" });
      }

      res.json(subscriptionType[0]);
    } catch (error) {
      next(error);
    }
  });

  // Create a new subscription type (admin only)
  app.post("/api/subscription-types", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const societyId = getUserSocietyId(user);
      
      const { name, description, amount, period, periodMonths, isActive, autoRenew } = req.body;

      // Validate required fields
      if (!name || !amount || !period) {
        return res.status(400).json({ message: "Missing required fields: name, amount, period" });
      }

      // Validate period
      const validPeriods = ['monthly', 'quarterly', 'yearly', 'custom'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ message: "Invalid period. Must be one of: monthly, quarterly, yearly, custom" });
      }

      // Validate periodMonths for custom periods
      if (period === 'custom' && (!periodMonths || periodMonths < 1)) {
        return res.status(400).json({ message: "periodMonths is required and must be at least 1 for custom periods" });
      }

      // Validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ message: "Invalid amount. Must be a positive number" });
      }

      const newSubscriptionType = await db
        .insert(subscriptionTypes)
        .values({
          name,
          description: description || null,
          amount: parsedAmount.toString(),
          period,
          periodMonths: period === 'custom' ? periodMonths : 1,
          isActive: isActive !== undefined ? isActive : true,
          autoRenew: autoRenew !== undefined ? autoRenew : false,
          societyId,
        })
        .returning();

      res.status(201).json(newSubscriptionType[0]);
    } catch (error) {
      next(error);
    }
  });

  // Update a subscription type (admin only)
  app.put("/api/subscription-types/:id", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const societyId = getUserSocietyId(user);
      
      const { name, description, amount, period, periodMonths, isActive, autoRenew } = req.body;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: "Invalid subscription type ID" });
      }

      // Check if subscription type exists and belongs to user's society
      const existingSubscription = await db
        .select()
        .from(subscriptionTypes)
        .where(and(eq(subscriptionTypes.id, id), eq(subscriptionTypes.societyId, societyId)))
        .limit(1);

      if (existingSubscription.length === 0) {
        return res.status(404).json({ message: "Subscription type not found" });
      }

      // Validate period if provided
      if (period) {
        const validPeriods = ['monthly', 'quarterly', 'yearly', 'custom'];
        if (!validPeriods.includes(period)) {
          return res.status(400).json({ message: "Invalid period. Must be one of: monthly, quarterly, yearly, custom" });
        }
      }

      // Validate periodMonths for custom periods
      if (period === 'custom' && (!periodMonths || periodMonths < 1)) {
        return res.status(400).json({ message: "periodMonths is required and must be at least 1 for custom periods" });
      }

      // Validate amount if provided
      if (amount !== undefined) {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
          return res.status(400).json({ message: "Invalid amount. Must be a positive number" });
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (amount !== undefined) updateData.amount = parseFloat(amount).toString();
      if (period !== undefined) updateData.period = period;
      if (periodMonths !== undefined) updateData.periodMonths = periodMonths;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
      updateData.updatedAt = new Date();

      const updatedSubscriptionType = await db
        .update(subscriptionTypes)
        .set(updateData)
        .where(and(eq(subscriptionTypes.id, id), eq(subscriptionTypes.societyId, societyId)))
        .returning();

      res.json(updatedSubscriptionType[0]);
    } catch (error) {
      next(error);
    }
  });

  // Delete a subscription type (admin only)
  app.delete("/api/subscription-types/:id", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const societyId = getUserSocietyId(user);

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: "Invalid subscription type ID" });
      }

      // Check if subscription type exists and belongs to user's society
      const existingSubscription = await db
        .select()
        .from(subscriptionTypes)
        .where(and(eq(subscriptionTypes.id, id), eq(subscriptionTypes.societyId, societyId)))
        .limit(1);

      if (existingSubscription.length === 0) {
        return res.status(404).json({ message: "Subscription type not found" });
      }

      await db
        .delete(subscriptionTypes)
        .where(and(eq(subscriptionTypes.id, id), eq(subscriptionTypes.societyId, societyId)));

      res.json({ message: "Subscription type deleted successfully" });
    } catch (error) {
      next(error);
    }
  });
}
