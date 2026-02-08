import { db } from "../server/db";
import { notifications, notificationMessages, users, notes, noteMessages } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function seedNoteBasedNotifications() {
  console.log("Seeding note-based notifications...");

  // Get all users
  const allUsers = await db.select().from(users);

  if (allUsers.length === 0) {
    console.log("No users found. Please seed users first.");
    return;
  }

  // Get society ID from first user
  const societyId = allUsers[0].societyId;

  // Clear existing notifications and messages
  await db.delete(notifications).where(eq(notifications.societyId, societyId));
  // Messages will be deleted automatically due to ON DELETE CASCADE
  console.log("Cleared existing notifications and messages");

  // Get existing notes with their messages
  const notesWithMessages = await db
    .select({
      note: notes,
      messages: noteMessages,
    })
    .from(notes)
    .leftJoin(noteMessages, eq(notes.id, noteMessages.noteId))
    .where(eq(noteMessages.language, "eu"))
    .limit(5); // Create notifications for first 5 notes

  if (notesWithMessages.length === 0) {
    console.log("No notes found. Please seed notes first.");
    return;
  }

  console.log(`Creating notifications for ${notesWithMessages.length} notes`);

  // Create notifications for each note
  for (const noteData of notesWithMessages) {
    const note = noteData.note;
    const primaryMessage = noteData.messages;

    if (!primaryMessage) continue;

    console.log(`Processing note: ${primaryMessage.title}`);

    // Get all messages for this note
    const allMessages = await db
      .select()
      .from(noteMessages)
      .where(eq(noteMessages.noteId, note.id));

    // Group messages by language
    const messagesByLanguage = allMessages.reduce((acc: Record<string, any>, msg: any) => {
      acc[msg.language] = msg;
      return acc;
    }, {});

    // Create notifications for all users
    for (const user of allUsers) {
      const userLanguage = "eu"; // Default to Basque

      // Make some notifications read and some unread
      const isRead = Math.random() > 0.6; // 40% unread

      const [notification] = await db
        .insert(notifications)
        .values({
          userId: user.id,
          societyId,
          referenceId: note.id,
          title: messagesByLanguage["eu"]?.title || messagesByLanguage["es"]?.title || "",
          message: messagesByLanguage["eu"]?.content || messagesByLanguage["es"]?.content || "",
          isRead,
          readAt: isRead ? new Date() : null,
          defaultLanguage: "eu",
          createdAt: new Date(note.createdAt), // Use note's creation date
          updatedAt: new Date(),
        })
        .returning();

      // Create notification messages with proper fallback
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

    console.log(`Created ${allUsers.length} notifications for note: ${primaryMessage.title}`);
  }

  console.log("Note-based notifications seeded successfully!");
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedNoteBasedNotifications()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Error seeding note-based notifications:", error);
      process.exit(1);
    });
}

export default seedNoteBasedNotifications;
