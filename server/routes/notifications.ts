import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { notifications, notificationMessages, users, type User, type Notification } from "@shared/schema";
import { eq, and, desc, count, isNotNull } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

// Helper function to get localized notification message
const getLocalizedNotification = async (notification: Notification, preferredLanguage: string = 'eu') => {
  // Try to get message in preferred language
  const localizedMessage = await db
    .select()
    .from(notificationMessages)
    .where(and(
      eq(notificationMessages.notificationId, notification.id),
      eq(notificationMessages.language, preferredLanguage)
    ))
    .limit(1);

  if (localizedMessage.length > 0) {
    return {
      ...notification,
      title: localizedMessage[0].title,
      message: localizedMessage[0].message,
    };
  }

  // Try the other available language as fallback
  const fallbackLanguage = preferredLanguage === 'eu' ? 'es' : 'eu';
  const fallbackMessage = await db
    .select()
    .from(notificationMessages)
    .where(and(
      eq(notificationMessages.notificationId, notification.id),
      eq(notificationMessages.language, fallbackLanguage)
    ))
    .limit(1);

  if (fallbackMessage.length > 0) {
    return {
      ...notification,
      title: fallbackMessage[0].title,
      message: fallbackMessage[0].message,
    };
  }

  // Fallback to default language
  const defaultMessage = await db
    .select()
    .from(notificationMessages)
    .where(and(
      eq(notificationMessages.notificationId, notification.id),
      eq(notificationMessages.language, notification.defaultLanguage)
    ))
    .limit(1);

  if (defaultMessage.length > 0) {
    return {
      ...notification,
      title: defaultMessage[0].title,
      message: defaultMessage[0].message,
    };
  }

  // Fallback to original notification fields
  return notification;
};

// Get user notifications with pagination
export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const societyId = getUserSocietyId(user);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const preferredLanguage = (req.query.lang as string) || 'eu';
    const filter = (req.query.filter as string) || 'all';
    
    // Build the base query conditions
    const baseConditions = [
      eq(notifications.userId, user.id),
      eq(notifications.societyId, societyId)
    ];
    
    // Add filter conditions if specified
    if (filter === 'unread') {
      baseConditions.push(eq(notifications.isRead, false));
    } else if (filter === 'read') {
      baseConditions.push(eq(notifications.isRead, true));
    }
    
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(and(...baseConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get localized notifications
    const localizedNotifications = await Promise.all(
      userNotifications.map(notification => getLocalizedNotification(notification, preferredLanguage))
    );

    // Get total count for pagination (respecting the same filter)
    const totalCount = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...baseConditions));

    return res.status(200).json({
      notifications: localizedNotifications,
      pagination: {
        page,
        limit,
        total: totalCount[0]?.count || 0,
        pages: Math.ceil((totalCount[0]?.count || 0) / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get unread notifications count
export const getUnreadNotificationsCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const societyId = getUserSocietyId(user);

    const unreadCount = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.societyId, societyId),
        eq(notifications.isRead, false)
      ));

    return res.status(200).json({ count: unreadCount[0]?.count || 0 });
  } catch (err) {
    next(err);
  }
};

// Get last 5 notifications for bell dropdown
export const getRecentNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const societyId = getUserSocietyId(user);
    const preferredLanguage = (req.query.lang as string) || 'eu';
    
    const recentNotifications = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.societyId, societyId)
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(5);

    // Get localized notifications
    const localizedNotifications = await Promise.all(
      recentNotifications.map(notification => getLocalizedNotification(notification, preferredLanguage))
    );

    return res.status(200).json(localizedNotifications);
  } catch (err) {
    next(err);
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const societyId = getUserSocietyId(user);

    const updated = await db
      .update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, user.id),
        eq(notifications.societyId, societyId)
      ))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json(updated[0]);
  } catch (err) {
    next(err);
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const societyId = getUserSocietyId(user);

    await db
      .update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.societyId, societyId),
        eq(notifications.isRead, false)
      ));

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};

// Create notification (for system use)
export const createNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const societyId = getUserSocietyId(user);
    const { title, message, type, targetUserId, messages, defaultLanguage = 'eu' } = req.body;

    // Only admins can create notifications for other users
    if (targetUserId && targetUserId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: "Only admins can create notifications for other users" });
    }

    const notificationData = {
      userId: targetUserId || user.id,
      societyId,
      title: title || (messages?.eu?.title) || '',
      message: message || (messages?.eu?.message) || '',
      isRead: false,
      defaultLanguage
    };

    const newNotification = await db
      .insert(notifications)
      .values(notificationData)
      .returning();

    // Create multilingual messages if provided
    if (messages && typeof messages === 'object') {
      const messageEntries = Object.entries(messages).map(([lang, msg]) => ({
        notificationId: newNotification[0].id,
        language: lang,
        title: (msg as any).title || title,
        message: (msg as any).message || message,
      }));

      if (messageEntries.length > 0) {
        await db.insert(notificationMessages).values(messageEntries);
      }
    }

    return res.status(201).json(newNotification[0]);
  } catch (err) {
    next(err);
  }
};

export function registerNotificationRoutes(app: any) {
  app.get("/api/notifications", sessionMiddleware, requireAuth, getUserNotifications);
  app.get("/api/notifications/unread-count", sessionMiddleware, requireAuth, getUnreadNotificationsCount);
  app.get("/api/notifications/recent", sessionMiddleware, requireAuth, getRecentNotifications);
  app.patch("/api/notifications/:id/read", sessionMiddleware, requireAuth, markNotificationAsRead);
  app.patch("/api/notifications/mark-all-read", sessionMiddleware, requireAuth, markAllNotificationsAsRead);
  app.post("/api/notifications", sessionMiddleware, requireAuth, createNotification);
  
  // New endpoint to mark all note notifications as read
  app.patch("/api/notifications/notes/mark-all-read", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      
      // Mark all unread notifications that have a referenceId (indicating they're from notes) as read for this user
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.userId, user.id),
          isNotNull(notifications.referenceId),
          eq(notifications.isRead, false)
        ));

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
}
