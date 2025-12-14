import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { oharrak, type User } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requireAdmin } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

export function registerNoteRoutes(app: Express) {
  app.get("/api/oharrak", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const notes = await db.select().from(oharrak)
        .where(eq(oharrak.societyId, societyId))
        .orderBy(desc(oharrak.createdAt));
      res.json(notes);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/oharrak", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const { title, content } = req.body;
      
      const [newNote] = await db.insert(oharrak).values({
        title,
        content,
        isActive: true,
        createdBy: req.user!.id,
        societyId,
      }).returning();
      
      res.status(201).json(newNote);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/oharrak/:id", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, content, isActive } = req.body;
      const societyId = getUserSocietyId(req.user!);
      
      const [updatedNote] = await db
        .update(oharrak)
        .set({ 
          title, 
          content, 
          isActive,
          updatedAt: new Date()
        })
        .where(and(
          eq(oharrak.id, id),
          eq(oharrak.societyId, societyId)
        ))
        .returning();
      
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json(updatedNote);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/oharrak/:id", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const societyId = getUserSocietyId(req.user!);
      
      const deletedNote = await db
        .delete(oharrak)
        .where(and(
          eq(oharrak.id, id),
          eq(oharrak.societyId, societyId)
        ))
        .returning();
      
      if (!deletedNote[0]) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
}
