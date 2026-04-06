import "dotenv/config";
import { notifications, notificationMessages, users, notes, noteMessages } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedNotifications(dbConn: SeedDb) {
  console.log("Seeding note-based notifications...");

  const allUsers = await dbConn.select().from(users);

  if (allUsers.length === 0) {
    console.log("No users found. Please seed users first.");
    return;
  }

  const societyId = allUsers[0].societyId;

  await dbConn.delete(notifications).where(eq(notifications.societyId, societyId));
  console.log("Cleared existing notifications and messages");

  const notesWithMessages = await dbConn
    .select({
      note: notes,
      messages: noteMessages,
    })
    .from(notes)
    .leftJoin(noteMessages, eq(notes.id, noteMessages.noteId))
    .where(eq(noteMessages.language, "eu"))
    .limit(5);

  if (notesWithMessages.length === 0) {
    console.log("No notes found. Please seed notes first.");
    return;
  }

  console.log(`Creating notifications for ${notesWithMessages.length} notes`);

  for (const noteData of notesWithMessages) {
    const note = noteData.note;
    const primaryMessage = noteData.messages;

    if (!primaryMessage) continue;

    console.log(`Processing note: ${primaryMessage.title}`);

    const allMessages = await dbConn
      .select()
      .from(noteMessages)
      .where(eq(noteMessages.noteId, note.id));

    const messagesByLanguage = allMessages.reduce(
      (acc: Record<string, (typeof allMessages)[0]>, msg: (typeof allMessages)[0]) => {
        acc[msg.language] = msg;
        return acc;
      },
      {}
    );

    for (const user of allUsers) {
      const isRead = Math.random() > 0.6;

      const [notification] = await dbConn
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
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(),
        })
        .returning();

      await dbConn.insert(notificationMessages).values([
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

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedNotifications(db)
    .catch(error => {
      console.error("Error seeding note-based notifications:", error);
      process.exitCode = 1;
    })
    .finally(() =>
      pool.end().then(() => {
        process.exit(process.exitCode ?? 0);
      })
    );
}
