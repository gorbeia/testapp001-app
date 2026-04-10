import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  notificationMessages,
  notifications,
  societies,
  users,
  isValidLanguage,
  type Language,
} from "@shared/schema";
import { getMailTransport } from "./transport";

function uniqueLangOrder(...candidates: (string | null | undefined)[]): Language[] {
  const seen = new Set<string>();
  const out: Language[] = [];
  for (const c of candidates) {
    if (!c || seen.has(c) || !isValidLanguage(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * Resolves localized title/body for an email from notification rows.
 */
export function resolveNotificationEmailContent(opts: {
  notification: { title: string; message: string; defaultLanguage: string };
  messages: { language: string; title: string; message: string }[];
  preferredLanguage: string;
}): { title: string; text: string } {
  const byLang = new Map(opts.messages.map(m => [m.language, m]));
  const order = uniqueLangOrder(
    opts.preferredLanguage,
    opts.notification.defaultLanguage,
    "eu",
    "es",
    "en"
  );

  for (const lang of order) {
    const row = byLang.get(lang);
    if (row) {
      return { title: row.title, text: row.message };
    }
  }

  return { title: opts.notification.title, text: opts.notification.message };
}

/**
 * Sends the in-app notification as email to the user's login address (`username`) when allowed.
 * Safe to fire-and-forget: log errors, do not throw to callers.
 */
export async function sendUserNotificationEmail(opts: {
  userId: string;
  notificationId: string;
}): Promise<void> {
  try {
    const [user] = await db
      .select({
        username: users.username,
        notifyEmail: users.notifyEmail,
        communicationLanguage: users.communicationLanguage,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, opts.userId))
      .limit(1);

    if (!user?.isActive || !user.notifyEmail) return;

    const to = user.username?.trim();
    if (!to || !to.includes("@")) return;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.id, opts.notificationId), eq(notifications.userId, opts.userId))
      )
      .limit(1);

    if (!notification) return;

    const messages = await db
      .select()
      .from(notificationMessages)
      .where(eq(notificationMessages.notificationId, opts.notificationId));

    const [society] = await db
      .select({ name: societies.name })
      .from(societies)
      .where(eq(societies.id, notification.societyId))
      .limit(1);

    const fromName = society?.name?.trim() || undefined;

    const { title, text } = resolveNotificationEmailContent({
      notification,
      messages,
      preferredLanguage: user.communicationLanguage,
    });

    await getMailTransport().send({
      to,
      subject: title,
      text,
      fromName,
    });
  } catch (err) {
    console.error("[mail] sendUserNotificationEmail failed", err);
  }
}

/**
 * Queue notification email without blocking the request path.
 */
export function queueUserNotificationEmail(opts: { userId: string; notificationId: string }): void {
  void sendUserNotificationEmail(opts);
}
