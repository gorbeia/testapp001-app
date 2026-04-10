import { db } from "../db";
import { notifications, notificationMessages } from "@shared/schema";
import { translate, translateWithParams, type Language, type TranslationKey } from "./i18n";
import { queueUserNotificationEmail } from "./mail";

export async function notifyFinancialEvent(opts: {
  userId: string;
  societyId: string;
  referenceId?: string | null;
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  params: Record<string, string | number>;
}) {
  const titleKey = opts.titleKey;
  const messageKey = opts.messageKey;
  const euTitle = translate(titleKey, "eu");
  const euMsg = translateWithParams(messageKey as TranslationKey, opts.params, "eu");

  const [notification] = await db
    .insert(notifications)
    .values({
      userId: opts.userId,
      societyId: opts.societyId,
      referenceId: opts.referenceId ?? null,
      title: euTitle,
      message: euMsg,
      defaultLanguage: "eu",
    })
    .returning();

  const langs: Language[] = ["eu", "es", "en"];
  const messages = langs.map(lang => ({
    notificationId: notification.id,
    language: lang,
    title: translate(titleKey, lang),
    message: translateWithParams(messageKey as TranslationKey, opts.params, lang),
  }));

  await db.insert(notificationMessages).values(messages);
  queueUserNotificationEmail({ userId: opts.userId, notificationId: notification.id });
  return notification;
}
