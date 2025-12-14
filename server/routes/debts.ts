import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { credits, users, type User } from "@shared/schema";
import { eq, and, sum, inArray, desc } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

// Helper function to check if user has treasurer access
const requireTreasurerAccess = (user: User): boolean => {
  return user.function === 'diruzaina' || user.function === 'administratzailea';
};

// Treasurer middleware
const requireTreasurer = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!requireTreasurerAccess(req.user)) {
    return res.status(403).json({ message: "Treasurer access required" });
  }
  
  next();
};

export function registerDebtRoutes(app: Express) {
  // Get current user's credits (authenticated users only)
  app.get("/api/credits/member/current", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      const { month, status } = req.query;
      const userId = req.user!.id;
      
      const conditions = [eq(credits.memberId, userId)];
      
      if (month) {
        conditions.push(eq(credits.month, month as string));
      }
      
      if (status && status !== 'all') {
        conditions.push(eq(credits.status, status as string));
      }
      
      let query = db.select().from(credits).where(and(...conditions));
      
      const userCredits = await query.orderBy(desc(credits.year), desc(credits.monthNumber));
      
      res.json(userCredits);
    } catch (error) {
      next(error);
    }
  });

  // Get all credits (treasurer only)
  app.get("/api/credits", sessionMiddleware, requireTreasurer, async (req, res, next) => {
    try {
      const { month, status } = req.query;
      
      const conditions = [];
      
      if (month) {
        conditions.push(eq(credits.month, month as string));
      }
      
      if (status) {
        conditions.push(eq(credits.status, status as string));
      }

      const baseQuery = db.select().from(credits);
      const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

      const allCredits = await query.orderBy(credits.year, credits.monthNumber, credits.memberId);
      
      // Get member names and payment tracking info
      const creditsWithNames = await Promise.all(
        allCredits.map(async (credit) => {
          const [member] = await db.select().from(users).where(eq(users.id, credit.memberId));
          let markedByUser = null;
          
          if (credit.markedAsPaidBy) {
            const [markedBy] = await db.select().from(users).where(eq(users.id, credit.markedAsPaidBy));
            markedByUser = markedBy?.name || null;
            if (!markedBy) {
              console.log(`User not found for markedAsPaidBy: ${credit.markedAsPaidBy} for credit ${credit.id}`);
            }
          } else if (credit.status === 'paid') {
            // Credit was marked as paid before tracking was implemented
            markedByUser = 'Ezezaguna (aurreko sistema)';
          }
          
          return {
            ...credit,
            memberName: member?.name || 'Unknown',
            markedByUser: markedByUser,
            markedByUserName: markedByUser
          };
        })
      );

      res.json(creditsWithNames);
    } catch (error) {
      next(error);
    }
  });

  // Get credits sum by status (for dashboard stats)
  app.get("/api/credits/sum", sessionMiddleware, requireTreasurer, async (req, res, next) => {
    try {
      const { status } = req.query;
      
      const conditions = [];
      
      if (status && ['pending', 'paid', 'partial'].includes(status as string)) {
        conditions.push(eq(credits.status, status as string));
      }
      
      const result = await db
        .select({
          sum: sum(credits.totalAmount)
        })
        .from(credits)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const totalSum = result[0]?.sum || 0;
      
      res.json({ sum: parseFloat(totalSum.toString()) || 0 });
    } catch (error) {
      next(error);
    }
  });

  // Batch update credit status
  app.put("/api/credits/batch-status", sessionMiddleware, requireTreasurer, async (req, res, next) => {
    try {
      const { creditIds, status } = req.body;

      if (!['pending', 'paid', 'partial'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      if (!Array.isArray(creditIds) || creditIds.length === 0) {
        return res.status(400).json({ message: "Invalid credit IDs" });
      }

      // Get all credits to validate and check current month restriction
      const creditsToUpdate = await db
        .select()
        .from(credits)
        .where(inArray(credits.id, creditIds));

      if (creditsToUpdate.length === 0) {
        return res.status(404).json({ message: "No credits found" });
      }

      // Check if any are for current month (only when marking as paid)
      if (status === 'paid') {
        const currentDate = new Date();
        const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const currentMonthCredits = creditsToUpdate.filter(credit => credit.month === currentMonthString);
        if (currentMonthCredits.length > 0) {
          return res.status(400).json({ 
            message: "Ezin da uneko hilabetea itxi. Itxaron hilabetea amaitu arte." 
          });
        }
      }

      // Update all credits
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      // Add payment tracking if marking as paid
      if (status === 'paid') {
        updateData.markedAsPaidBy = req.user!.id;
        updateData.markedAsPaidAt = new Date();
      }

      const updatedCredits = await db
        .update(credits)
        .set(updateData)
        .where(inArray(credits.id, creditIds))
        .returning();

      res.json({ 
        message: `Updated ${updatedCredits.length} credits`,
        updatedCredits 
      });
    } catch (error) {
      next(error);
    }
  });
}
