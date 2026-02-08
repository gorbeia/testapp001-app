import type { Express } from "express";
import { db } from "../db";
import { societies, type User } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requireAdmin } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerSocietyRoutes(app: Express) {
  // Society management routes
  app.get("/api/societies", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const allSocieties = await db.select().from(societies).orderBy(societies.createdAt);
      res.json(allSocieties);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/societies/active", requireAuth, async (req, res, next) => {
    try {
      const activeSociety = await db
        .select()
        .from(societies)
        .where(eq(societies.isActive, true))
        .limit(1);
      if (activeSociety.length === 0) {
        // If no active society, return the first one
        const firstSociety = await db.select().from(societies).limit(1);
        res.json(firstSociety[0] || null);
      } else {
        res.json(activeSociety[0]);
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/societies/user", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const societyId = getUserSocietyId(req.user);
      const society = await db.select().from(societies).where(eq(societies.id, societyId)).limit(1);

      if (society.length === 0) {
        return res.status(404).json({ message: "Society not found" });
      }

      res.json(society[0]);
    } catch (error) {
      console.error("Error in /api/societies/user:", error);
      next(error);
    }
  });

  app.get("/api/societies/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const society = await db.select().from(societies).where(eq(societies.id, id));

      if (society.length === 0) {
        return res.status(404).json({ message: "Society not found" });
      }

      res.json(society[0]);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/societies", requireAdmin, async (req, res, next) => {
    try {
      const societyData = req.body;

      // If this is the first society, make it active
      const existingSocieties = await db.select().from(societies);
      if (existingSocieties.length === 0) {
        societyData.isActive = true;
      }

      const [newSociety] = await db.insert(societies).values(societyData).returning();
      res.status(201).json(newSociety);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/societies/:id", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        name,
        iban,
        creditorId,
        address,
        phone,
        email,
        reservationPricePerMember,
        kitchenPricePerMember,
      } = req.body;

      const [updatedSociety] = await db
        .update(societies)
        .set({
          name,
          iban,
          creditorId,
          address,
          phone,
          email,
          reservationPricePerMember,
          kitchenPricePerMember,
          updatedAt: new Date(),
        })
        .where(eq(societies.id, id))
        .returning();

      if (!updatedSociety) {
        return res.status(404).json({ message: "Society not found" });
      }

      res.json(updatedSociety);
    } catch (error) {
      console.error("Error updating society:", error);
      next(error);
    }
  });

  app.post("/api/societies/:id/toggle", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;

      // Get current society
      const [currentSociety] = await db.select().from(societies).where(eq(societies.id, id));
      if (!currentSociety) {
        return res.status(404).json({ message: "Society not found" });
      }

      // If activating this society, deactivate all others first
      if (!currentSociety.isActive) {
        await db.update(societies).set({ isActive: false }).where(eq(societies.isActive, true));
      }

      // Toggle the society
      const [updatedSociety] = await db
        .update(societies)
        .set({
          isActive: !currentSociety.isActive,
          updatedAt: new Date(),
        })
        .where(eq(societies.id, id))
        .returning();

      res.json(updatedSociety);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/societies/:id", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check if society exists
      const [existingSociety] = await db.select().from(societies).where(eq(societies.id, id));
      if (!existingSociety) {
        return res.status(404).json({ message: "Society not found" });
      }

      // Don't allow deletion of active society
      if (existingSociety.isActive) {
        return res.status(400).json({ message: "Cannot delete active society" });
      }

      await db.delete(societies).where(eq(societies.id, id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
}
