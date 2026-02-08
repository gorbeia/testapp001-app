import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  notes,
  noteMessages,
  users,
  notifications,
  notificationMessages,
  type User,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requireAdmin } from "./middleware";

// Helper function to convert a note into notifications for all users in a society
async function convertNoteToNotifications(noteId: string, societyId: string) {
  try {
    // Get all users in the society (including admins now)
    const societyUsers = await db.select().from(users).where(eq(users.societyId, societyId));

    // Get the note with its messages
    const noteWithMessages = await db
      .select({
        note: notes,
        messages: noteMessages,
      })
      .from(notes)
      .leftJoin(noteMessages, eq(notes.id, noteMessages.noteId))
      .where(eq(notes.id, noteId));

    if (!noteWithMessages || noteWithMessages.length === 0) {
      throw new Error("Note not found");
    }

    // Extract the note and messages
    const note = noteWithMessages[0].note;
    const messages = noteWithMessages.filter(row => row.messages).map(row => row.messages);

    // Group messages by language
    const messagesByLanguage = messages.reduce((acc: Record<string, any>, msg: any) => {
      acc[msg.language] = msg;
      return acc;
    }, {});

    // Create a notification for each user using the note content
    for (const user of societyUsers) {
      // Determine user language preference (default to 'eu' if not set)
      const userLanguage = "eu"; // Since users table doesn't have language field, default to Basque

      // Create the main notification with note content
      const [notification] = await db
        .insert(notifications)
        .values({
          userId: user.id,
          societyId,
          referenceId: noteId, // Link back to the original note
          title: messagesByLanguage["eu"]?.title || messagesByLanguage["es"]?.title || "",
          message: messagesByLanguage["eu"]?.content || messagesByLanguage["es"]?.content || "",
          isRead: false,
        })
        .returning();

      // Create notification messages for both languages (for the notification system)
      await db.insert(notificationMessages).values([
        {
          notificationId: notification.id,
          language: "eu",
          title: messagesByLanguage["eu"]?.title || messagesByLanguage["es"]?.title || "",
          message: messagesByLanguage["eu"]?.content || messagesByLanguage["es"]?.content || "",
        },
        {
          notificationId: notification.id,
          language: "es",
          title: messagesByLanguage["es"]?.title || messagesByLanguage["eu"]?.title || "",
          message: messagesByLanguage["es"]?.content || messagesByLanguage["eu"]?.content || "",
        },
      ]);
    }

    console.log(`Converted note ${noteId} to notifications for ${societyUsers.length} users`);
  } catch (error) {
    console.error("Error converting note to notifications:", error);
    throw error;
  }
}

// Helper function to remove notifications for a specific note
async function removeNoteNotifications(noteId: string, societyId: string) {
  try {
    // Delete all notifications that reference this note (including admin notifications)
    const deletedNotifications = await db
      .delete(notifications)
      .where(and(eq(notifications.referenceId, noteId), eq(notifications.societyId, societyId)))
      .returning();

    console.log(`Removed ${deletedNotifications.length} notifications for note ${noteId}`);
  } catch (error) {
    console.error("Error removing note notifications:", error);
    throw error;
  }
}
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerNoteRoutes(app: Express) {
  app.get(
    "/api/notes",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const notesData = await db
          .select()
          .from(notes)
          .where(eq(notes.societyId, societyId))
          .orderBy(desc(notes.createdAt));

        // Get messages for each note
        const notesWithMessages = await Promise.all(
          notesData.map(async (note: any) => {
            const messages = await db
              .select()
              .from(noteMessages)
              .where(eq(noteMessages.noteId, note.id));

            return {
              ...note,
              messages,
            };
          })
        );

        res.json(notesWithMessages);
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    "/api/notes",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const { messages } = req.body; // Expect messages array: [{ language: 'eu', title: '...', content: '...' }, { language: 'es', title: '...', content: '...' }]

        const [newNote] = await db
          .insert(notes)
          .values({
            isActive: true,
            createdBy: req.user!.id,
            societyId,
          })
          .returning();

        // Insert messages for each language
        const noteMessagesData = await Promise.all(
          messages.map(async (msg: any) => {
            return await db
              .insert(noteMessages)
              .values({
                noteId: newNote.id,
                language: msg.language,
                title: msg.title,
                content: msg.content,
              })
              .returning();
          })
        );

        res.status(201).json({
          ...newNote,
          messages: noteMessagesData.flat(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    "/api/notes/:id",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { messages, isActive } = req.body;
        const societyId = getUserSocietyId(req.user!);

        const [updatedNote] = await db
          .update(notes)
          .set({
            isActive,
            updatedAt: new Date(),
          })
          .where(and(eq(notes.id, id), eq(notes.societyId, societyId)))
          .returning();

        if (!updatedNote) {
          return res.status(404).json({ message: "Note not found" });
        }

        // Update messages for each language
        if (messages && messages.length > 0) {
          // Delete existing messages
          await db.delete(noteMessages).where(eq(noteMessages.noteId, id));

          // Insert new messages
          const noteMessagesData = await Promise.all(
            messages.map(async (msg: any) => {
              return await db
                .insert(noteMessages)
                .values({
                  noteId: id,
                  language: msg.language,
                  title: msg.title,
                  content: msg.content,
                })
                .returning();
            })
          );

          return res.json({
            ...updatedNote,
            messages: noteMessagesData.flat(),
          });
        }

        res.json(updatedNote);
      } catch (error) {
        next(error);
      }
    }
  );

  app.delete(
    "/api/notes/:id",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const societyId = getUserSocietyId(req.user!);

        const deletedNote = await db
          .delete(notes)
          .where(and(eq(notes.id, id), eq(notes.societyId, societyId)))
          .returning();

        if (!deletedNote[0]) {
          return res.status(404).json({ message: "Note not found" });
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /api/notes/:id/notify - Toggle notification flag for a note (admin only)
  app.put(
    "/api/notes/:id/notify",
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { notifyUsers } = req.body;

        if (typeof notifyUsers !== "boolean") {
          return res.status(400).json({ message: "notifyUsers must be a boolean" });
        }

        const user = req.user as User;

        // Get the note to verify it belongs to the user's society
        const [existingNote] = await db
          .select()
          .from(notes)
          .where(and(eq(notes.id, id), eq(notes.societyId, user.societyId)))
          .limit(1);

        if (!existingNote) {
          return res.status(404).json({ message: "Note not found" });
        }

        // Update the notification flag
        const [updatedNote] = await db
          .update(notes)
          .set({ notifyUsers, updatedAt: new Date() })
          .where(eq(notes.id, id))
          .returning();

        // If enabling notifications, convert note to notifications for all users
        if (notifyUsers && !existingNote.notifyUsers) {
          await convertNoteToNotifications(updatedNote.id, user.societyId);
        }
        // If disabling notifications, remove existing notifications
        else if (!notifyUsers && existingNote.notifyUsers) {
          await removeNoteNotifications(updatedNote.id, user.societyId);
        }

        res.json(updatedNote);
      } catch (error) {
        next(error);
      }
    }
  );
}
