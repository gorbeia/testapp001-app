import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { notes, noteMessages, type User } from "@shared/schema";
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
  app.get("/api/notes", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const notesData = await db.select().from(notes)
        .where(eq(notes.societyId, societyId))
        .orderBy(desc(notes.createdAt));
      
      // Get messages for each note
      const notesWithMessages = await Promise.all(
        notesData.map(async (note: any) => {
          const messages = await db.select().from(noteMessages)
            .where(eq(noteMessages.noteId, note.id));
          
          return {
            ...note,
            messages
          };
        })
      );
      
      res.json(notesWithMessages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notes", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const { messages } = req.body; // Expect messages array: [{ language: 'eu', title: '...', content: '...' }, { language: 'es', title: '...', content: '...' }]
      
      const [newNote] = await db.insert(notes).values({
        isActive: true,
        createdBy: req.user!.id,
        societyId,
      }).returning();
      
      // Insert messages for each language
      const noteMessagesData = await Promise.all(
        messages.map(async (msg: any) => {
          return await db.insert(noteMessages).values({
            noteId: newNote.id,
            language: msg.language,
            title: msg.title,
            content: msg.content,
          }).returning();
        })
      );
      
      res.status(201).json({
        ...newNote,
        messages: noteMessagesData.flat()
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/notes/:id", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { messages, isActive } = req.body;
      const societyId = getUserSocietyId(req.user!);
      
      const [updatedNote] = await db
        .update(notes)
        .set({ 
          isActive,
          updatedAt: new Date()
        })
        .where(and(
          eq(notes.id, id),
          eq(notes.societyId, societyId)
        ))
        .returning();
      
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Update messages for each language
      if (messages && messages.length > 0) {
        // Delete existing messages
        await db.delete(noteMessages)
          .where(eq(noteMessages.noteId, id));
        
        // Insert new messages
        const noteMessagesData = await Promise.all(
          messages.map(async (msg: any) => {
            return await db.insert(noteMessages).values({
              noteId: id,
              language: msg.language,
              title: msg.title,
              content: msg.content,
            }).returning();
          })
        );
        
        return res.json({
          ...updatedNote,
          messages: noteMessagesData.flat()
        });
      }
      
      res.json(updatedNote);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/notes/:id", sessionMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const societyId = getUserSocietyId(req.user!);
      
      const deletedNote = await db
        .delete(notes)
        .where(and(
          eq(notes.id, id),
          eq(notes.societyId, societyId)
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
