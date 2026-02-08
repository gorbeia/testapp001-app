import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { credits, users, type User } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

// Helper function to check if user has treasurer access
const requireTreasurerAccess = (user: User): boolean => {
  return user.function === "diruzaina" || user.function === "administratzailea";
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

export function registerSepaRoutes(app: Express) {
  // Get debt data for SEPA export by month
  app.get(
    "/api/credits/sepa-export",
    sessionMiddleware,
    requireAuth,
    requireTreasurer,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { month } = req.query;

        if (!month) {
          return res.status(400).json({ message: "Month parameter is required" });
        }

        // First, let's check if there are any credits at all
        const allCredits = await db.select().from(credits);

        // Check credits for the specific month
        const monthCredits = await db
          .select()
          .from(credits)
          .where(eq(credits.month, month as string));

        // Get all credits for the specified month with user information
        const creditsData = await db
          .select({
            id: credits.id,
            memberId: credits.memberId,
            memberName: users.name,
            totalAmount: credits.totalAmount,
            status: credits.status,
            userIban: users.iban,
          })
          .from(credits)
          .innerJoin(users, eq(credits.memberId, users.id))
          .where(
            and(
              eq(credits.month, month as string),
              eq(credits.status, "pending") // Only include pending debts
            )
          );

        // Transform data for SEPA export
        const sepaCredits = creditsData.map(credit => ({
          id: credit.id,
          memberId: credit.memberId,
          memberName: credit.memberName,
          iban: credit.userIban, // Using user's IBAN
          amount: parseFloat(credit.totalAmount || "0"),
          selected: true, // Default to selected
          status: credit.status,
        }));

        res.json(sepaCredits);
      } catch (error) {
        next(error);
      }
    }
  );
}
