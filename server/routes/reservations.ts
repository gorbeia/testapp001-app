import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  users,
  reservations,
  notifications,
  notificationMessages,
  cancelReservationBodySchema,
  createReservationBodySchema,
  type JwtSessionUser,
  type Reservation,
} from "@shared/schema";
import { eq, and, or, like, gte, between, ne, count, desc, asc, sql } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { translateWithParams, formatDate, translations } from "../lib/i18n";
import { debtCalculationService } from "../cron-jobs";
import { insertAccountMovementRow, movementExistsForReference } from "../lib/account-movements";
import { notifyFinancialEvent } from "../lib/financial-notifications";
import {
  assertPrepaymentDebitAllowed,
  notifyIfCrossedPrepaymentFloor,
  prepaymentFloorHttpBody,
} from "../lib/prepayment-ledger-floor";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

// Helper function to map reservation type to email subject key
const getEmailSubjectKey = (
  type: "cancelled" | "confirmed" | "created"
): "reservationCancelled" | "reservationConfirmed" | "reservationCreated" => {
  const keyMap = {
    cancelled: "reservationCancelled" as const,
    confirmed: "reservationConfirmed" as const,
    created: "reservationCreated" as const,
  };
  return keyMap[type];
};

// Helper function to create reservation notifications
type ReservationNotificationSource = Pick<Reservation, "id" | "userId" | "societyId" | "startDate">;

const createReservationNotifications = async (
  reservationData: ReservationNotificationSource,
  reservationName: string,
  type: "created" | "cancelled" | "confirmed"
) => {
  const reservationDate = new Date(reservationData.startDate);

  // Define message keys based on type
  const messageKey =
    type === "cancelled"
      ? "reservationCancelledNotification"
      : type === "confirmed"
        ? "reservationConfirmedNotification"
        : "reservationCreatedNotification";

  // Create notification record
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: reservationData.userId,
      societyId: reservationData.societyId,
      referenceId: reservationData.id,
      title: translations.eu.emailSubject[getEmailSubjectKey(type)],
      message: translateWithParams(
        messageKey,
        {
          reservationName,
          date: formatDate(reservationDate, "eu"),
        },
        "eu"
      ),
      defaultLanguage: "eu",
    })
    .returning();

  const messages = [];

  // Basque
  const basqueMessage = translateWithParams(
    messageKey,
    {
      reservationName,
      date: formatDate(reservationDate, "eu"),
    },
    "eu"
  );

  messages.push({
    notificationId: notification.id,
    language: "eu",
    title: translations.eu.emailSubject[getEmailSubjectKey(type)],
    message: basqueMessage,
  });

  // Spanish
  const spanishMessage = translateWithParams(
    messageKey,
    {
      reservationName,
      date: formatDate(reservationDate, "es"),
    },
    "es"
  );

  messages.push({
    notificationId: notification.id,
    language: "es",
    title: translations.es.emailSubject[getEmailSubjectKey(type)],
    message: spanishMessage,
  });

  // English
  const englishMessage = translateWithParams(
    messageKey,
    {
      reservationName,
      date: formatDate(reservationDate, "en"),
    },
    "en"
  );

  messages.push({
    notificationId: notification.id,
    language: "en",
    title: translations.en.emailSubject[getEmailSubjectKey(type)],
    message: englishMessage,
  });

  await db.insert(notificationMessages).values(messages);

  return notification;
};

export function registerReservationRoutes(app: Express) {
  // Reservations API
  app.get(
    "/api/reservations",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);
        const { limit, month, user: userId, page = 1, search, type, status } = req.query;

        // Check if user is admin (administratzailea or diruzaina)
        const isAdmin = user.function === "administratzailea" || user.function === "diruzaina";

        // Parse pagination parameters
        const pageNum = parseInt(page as string, 10);
        const limitNum = limit ? parseInt(limit as string, 10) : 25;
        const offset = (pageNum - 1) * limitNum;

        // Validate pagination parameters
        if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({ message: "Invalid page parameter" });
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          return res
            .status(400)
            .json({ message: "Invalid limit parameter (must be between 1 and 100)" });
        }

        // Build the base query
        const baseQuery = db
          .select({
            id: reservations.id,
            userId: reservations.userId,
            societyId: reservations.societyId,
            name: reservations.name,
            type: reservations.type,
            status: reservations.status,
            startDate: reservations.startDate,
            guests: reservations.guests,
            useKitchen: reservations.useKitchen,
            table: reservations.table,
            totalAmount: reservations.totalAmount,
            notes: reservations.notes,
            cancellationReason: reservations.cancellationReason,
            cancelledBy: reservations.cancelledBy,
            cancelledAt: reservations.cancelledAt,
            createdAt: reservations.createdAt,
            updatedAt: reservations.updatedAt,
            userName: users.name,
          })
          .from(reservations)
          .leftJoin(users, eq(reservations.userId, users.id));

        // Apply filters based on query parameters
        const conditions = [eq(reservations.societyId, societyId)];

        // Check if this request is for upcoming reservations only
        const upcomingOnly = req.query.upcoming === "true";

        // For admin page or when not upcoming only: show all reservations (if admin)
        // For upcoming reservations page: only show future and confirmed reservations
        if (upcomingOnly || !isAdmin) {
          const now = new Date();
          conditions.push(gte(reservations.startDate, now));
          conditions.push(eq(reservations.status, "confirmed"));
        }

        // Apply month filter
        if (month && typeof month === "string" && month !== "all") {
          let year, monthNum;

          // Handle both "YYYY-MM" and "MM" formats
          if (month.includes("-")) {
            // YYYY-MM format
            year = parseInt(month.split("-")[0]);
            monthNum = parseInt(month.split("-")[1]);
          } else {
            // MM format - use current year
            year = new Date().getFullYear();
            monthNum = parseInt(month);
          }

          // Validate the parsed values
          if (!isNaN(year) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            const startDate = new Date(year, monthNum - 1, 1);
            const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
            conditions.push(between(reservations.startDate, startDate, endDate));
          }
        }

        // Apply user filter
        if (userId && typeof userId === "string" && userId !== "all") {
          conditions.push(eq(reservations.userId, userId));
        }

        // Apply status filter
        if (status && typeof status === "string" && status !== "all") {
          conditions.push(eq(reservations.status, status));
        }

        // Apply type filter
        if (type && typeof type === "string" && type !== "all") {
          conditions.push(eq(reservations.type, type));
        }

        // Apply search filter
        if (search && typeof search === "string") {
          const searchTerm = `%${search}%`;
          const searchCondition = or(
            like(reservations.name, searchTerm),
            like(reservations.table, searchTerm),
            like(users.name, searchTerm)
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

        // Get total count for pagination
        const countQuery = db
          .select({ count: count() })
          .from(reservations)
          .leftJoin(users, eq(reservations.userId, users.id))
          .where(and(...conditions));

        const countResult = await countQuery;
        const total = countResult[0]?.count || 0;
        const totalPages = Math.ceil(total / limitNum);

        // Get paginated results
        const reservationsList = await baseQuery
          .where(and(...conditions))
          .orderBy(upcomingOnly ? asc(reservations.startDate) : desc(reservations.startDate))
          .limit(limitNum)
          .offset(offset);

        // Return paginated response
        res.json({
          data: reservationsList,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Reservations: get user's own reservations (including old and cancelled ones)
  app.get(
    "/api/reservations/user",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const { search, status, type, month, page = 1, limit = 25 } = req.query;
        const societyId = getUserSocietyId(user);

        // Parse pagination parameters
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        // Validate pagination parameters
        if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({ message: "Invalid page parameter" });
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          return res
            .status(400)
            .json({ message: "Invalid limit parameter (must be between 1 and 100)" });
        }

        const conditions = [
          eq(reservations.userId, user.id),
          eq(reservations.societyId, societyId),
        ];

        // Add status filter
        if (status && status !== "all") {
          conditions.push(eq(reservations.status, status as string));
        }

        // Add type filter
        if (type && type !== "all") {
          conditions.push(eq(reservations.type, type as string));
        }

        // Add month filter
        if (month && month !== "all") {
          conditions.push(sql`EXTRACT(MONTH FROM ${reservations.startDate}) = ${month}`);
        }

        // Add search filter (search by name or table)
        if (search) {
          const searchTerm = `%${search}%`;
          const searchCondition = or(
            like(reservations.name, searchTerm),
            like(reservations.table, searchTerm)
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

        // Get total count for pagination
        const countQuery = db
          .select({ count: count() })
          .from(reservations)
          .where(and(...conditions));

        const countResult = await countQuery;
        const total = countResult[0]?.count || 0;
        const totalPages = Math.ceil(total / limitNum);

        // Get paginated results
        const userReservations = await db
          .select({
            id: reservations.id,
            userId: reservations.userId,
            societyId: reservations.societyId,
            name: reservations.name,
            type: reservations.type,
            status: reservations.status,
            startDate: reservations.startDate,
            guests: reservations.guests,
            useKitchen: reservations.useKitchen,
            table: reservations.table,
            totalAmount: reservations.totalAmount,
            notes: reservations.notes,
            createdAt: reservations.createdAt,
            updatedAt: reservations.updatedAt,
          })
          .from(reservations)
          .where(and(...conditions))
          .orderBy(desc(reservations.startDate))
          .limit(limitNum)
          .offset(offset);

        // Return paginated response
        res.json({
          data: userReservations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Reservation statistics for dashboard
  app.get(
    "/api/reservations/count",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { date, status } = req.query;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const conditions = [eq(reservations.societyId, societyId)];

        if (date) {
          const startOfDay = new Date(date as string);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date as string);
          endOfDay.setHours(23, 59, 59, 999);

          conditions.push(between(reservations.startDate, startOfDay, endOfDay));
        }

        if (status) {
          conditions.push(eq(reservations.status, status as string));
        }

        const result = await db
          .select({
            count: count(),
          })
          .from(reservations)
          .where(and(...conditions));

        res.json({ count: result[0]?.count || 0 });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/reservations/sum",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { date, status } = req.query;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const conditions = [eq(reservations.societyId, societyId)];

        if (date) {
          const startOfDay = new Date(date as string);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date as string);
          endOfDay.setHours(23, 59, 59, 999);

          conditions.push(between(reservations.startDate, startOfDay, endOfDay));
        }

        if (status) {
          conditions.push(eq(reservations.status, status as string));
        }

        // Get all reservations that match the criteria
        const reservationsList = await db
          .select({
            totalAmount: reservations.totalAmount,
          })
          .from(reservations)
          .where(and(...conditions));

        // Calculate total sum
        const totalSum = reservationsList.reduce((sum, reservation) => {
          return sum + parseFloat(reservation.totalAmount || "0");
        }, 0);

        res.json({ sum: totalSum });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/reservations/guests-sum",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { date, status } = req.query;
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const conditions = [eq(reservations.societyId, societyId)];

        if (date) {
          const startOfDay = new Date(date as string);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date as string);
          endOfDay.setHours(23, 59, 59, 999);

          conditions.push(between(reservations.startDate, startOfDay, endOfDay));
        }

        if (status) {
          conditions.push(eq(reservations.status, status as string));
        }

        // Get all reservations that match the criteria
        const reservationsList = await db
          .select({
            guests: reservations.guests,
          })
          .from(reservations)
          .where(and(...conditions));

        // Calculate total guests (add 1 for each reservation to include the person who made it)
        const totalGuests = reservationsList.reduce((sum, reservation) => {
          return sum + (reservation.guests || 0) + 1; // +1 for the person who made the reservation
        }, 0);

        res.json({ guestsSum: totalGuests });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/reservations/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        const societyId = getUserSocietyId(user);
        const reservation = await db
          .select()
          .from(reservations)
          .where(and(eq(reservations.id, id), eq(reservations.societyId, societyId)))
          .limit(1);

        if (!reservation.length) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        // Check access permissions
        if (
          reservation[0].userId !== user.id &&
          !["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "")
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        res.json(reservation[0]);
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    "/api/reservations",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);

        const parsed = createReservationBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid reservation payload",
            issues: parsed.error.flatten(),
          });
        }

        const { startDate, ...rest } = parsed.data;

        // Check if reservation date is in the past (ignoring time)
        const now = new Date();
        const reservationDate = new Date(startDate);

        // Reset time components to compare dates only
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const selectedDate = new Date(
          reservationDate.getFullYear(),
          reservationDate.getMonth(),
          reservationDate.getDate()
        );

        if (selectedDate < today) {
          return res.status(400).json({ message: "Reservations cannot be created for past dates" });
        }

        // Check if table is already reserved for the same date and event type (excluding cancelled reservations)
        const existingReservation = await db
          .select()
          .from(reservations)
          .where(
            and(
              eq(reservations.societyId, societyId),
              eq(reservations.table, rest.table),
              eq(reservations.startDate, startDate),
              eq(reservations.type, rest.type),
              ne(reservations.status, "cancelled")
            )
          )
          .limit(1);

        if (existingReservation.length > 0) {
          return res.status(400).json({
            message: `Table ${rest.table} is already reserved for this date and event type`,
          });
        }

        const resTotalPreview = Math.max(0, parseFloat(String(rest.totalAmount ?? "0")));
        const prepaymentCheck = await assertPrepaymentDebitAllowed(societyId, user.id, resTotalPreview);
        if (!prepaymentCheck.allowed) {
          return res.status(403).json(prepaymentFloorHttpBody(prepaymentCheck));
        }

        const reservationData = {
          ...rest,
          startDate,
          userId: user.id,
          societyId,
          status: "confirmed",
        };

        const newReservation = await db.insert(reservations).values(reservationData).returning();

        const resRow = newReservation[0];
        const resTotal = parseFloat(resRow.totalAmount || "0");
        if (resTotal > 0) {
          await insertAccountMovementRow({
            societyId,
            userId: resRow.userId,
            type: "reservation",
            amount: (-resTotal).toFixed(2),
            description: `Reservation: ${resRow.name}`,
            referenceId: resRow.id,
            referenceType: "reservation",
            createdBy: user.id,
          });
          try {
            await notifyIfCrossedPrepaymentFloor({
              societyId,
              userId: resRow.userId,
              balanceBefore: prepaymentCheck.balanceBefore,
              debitTotal: resTotal,
            });
          } catch (e) {
            console.error("Prepayment floor notification failed:", e);
          }
          try {
            await notifyFinancialEvent({
              userId: resRow.userId,
              societyId,
              referenceId: resRow.id,
              titleKey: "financialReservationChargeTitle",
              messageKey: "financialReservationChargeMessage",
              params: { name: resRow.name, amount: resTotal.toFixed(2) },
            });
          } catch (e) {
            console.error("Reservation charge notification failed:", e);
          }
        }

        // Get updated reservations list with user names
        const updatedReservations = await db
          .select({
            id: reservations.id,
            userId: reservations.userId,
            societyId: reservations.societyId,
            name: reservations.name,
            type: reservations.type,
            status: reservations.status,
            startDate: reservations.startDate,
            guests: reservations.guests,
            useKitchen: reservations.useKitchen,
            table: reservations.table,
            totalAmount: reservations.totalAmount,
            notes: reservations.notes,
            createdAt: reservations.createdAt,
            updatedAt: reservations.updatedAt,
            userName: users.name,
          })
          .from(reservations)
          .leftJoin(users, eq(reservations.userId, users.id))
          .where(eq(reservations.societyId, societyId))
          .orderBy(desc(reservations.createdAt));

        // Trigger real-time debt calculation for current month
        await debtCalculationService.calculateCurrentMonthDebtsForSociety(societyId);

        res.status(201).json({
          reservation: newReservation[0],
          reservations: updatedReservations || [],
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    "/api/reservations/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const parsed = cancelReservationBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid payload",
            issues: parsed.error.flatten(),
          });
        }
        const { cancellationReason } = parsed.data;
        const user = req.user!;

        const societyId = getUserSocietyId(user);
        const reservation = await db
          .select()
          .from(reservations)
          .where(and(eq(reservations.id, id), eq(reservations.societyId, societyId)))
          .limit(1);

        if (!reservation.length) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        // Check access permissions - users can only cancel their own reservations, but admins can cancel any
        if (user.function !== "administratzailea" && reservation[0].userId !== user.id) {
          return res.status(403).json({ message: "You can only cancel your own reservations" });
        }
        const isAdmin =
          ["administratzailea", "diruzaina", "sotolaria"].includes(user.function || "") ||
          ["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "");
        // For admin cancelling someone else's reservation, a cancellation reason is required
        if (isAdmin && reservation[0].userId !== user.id) {
          if (!cancellationReason || !String(cancellationReason).trim()) {
            return res.status(400).json({ message: "Cancellation reason is required" });
          }
        }

        // Check if reservation can be cancelled (not already cancelled or completed)
        if (["cancelled", "completed"].includes(reservation[0].status)) {
          return res.status(400).json({ message: "Reservation cannot be cancelled" });
        }

        // Update status to cancelled and store cancellation metadata
        const updatedReservation = await db
          .update(reservations)
          .set({
            status: "cancelled",
            cancellationReason: cancellationReason ?? reservation[0].cancellationReason ?? null,
            cancelledBy: user.id,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(reservations.id, id))
          .returning();

        const pre = reservation[0];
        const preTotal = parseFloat(pre.totalAmount || "0");
        if (
          preTotal > 0 &&
          !(await movementExistsForReference(societyId, "reservation_cancel", pre.id))
        ) {
          await insertAccountMovementRow({
            societyId,
            userId: pre.userId,
            type: "adjustment",
            amount: preTotal.toFixed(2),
            description: `Reservation cancelled: ${pre.name}`,
            referenceId: pre.id,
            referenceType: "reservation_cancel",
            createdBy: user.id,
          });
        }

        // Create cancellation notification for the user
        await createReservationNotifications(
          updatedReservation[0],
          reservation[0].name,
          "cancelled"
        );

        // Trigger real-time debt calculation for current month
        await debtCalculationService.calculateCurrentMonthDebtsForSociety(societyId);

        res.json(updatedReservation[0]);
      } catch (error) {
        next(error);
      }
    }
  );

  app.delete(
    "/api/reservations/:id",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        const societyId = getUserSocietyId(user);
        const reservation = await db
          .select()
          .from(reservations)
          .where(and(eq(reservations.id, id), eq(reservations.societyId, societyId)))
          .limit(1);

        if (!reservation.length) {
          return res.status(404).json({ message: "Reservation not found" });
        }

        // Check access permissions
        const isAdmin =
          ["administratzailea", "diruzaina", "sotolaria"].includes(user.function || "") ||
          ["administratzailea", "diruzaina", "sotolaria"].includes(user.role || "");

        if (reservation[0].userId !== user.id && !isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Create notification if admin is cancelling someone else's reservation
        if (reservation[0].userId !== user.id && isAdmin) {
          await createReservationNotifications(reservation[0], reservation[0].name, "cancelled");
        }

        const pre = reservation[0];
        const preTotal = parseFloat(pre.totalAmount || "0");
        if (
          pre.status !== "cancelled" &&
          preTotal > 0 &&
          !(await movementExistsForReference(societyId, "reservation_cancel", pre.id))
        ) {
          await insertAccountMovementRow({
            societyId,
            userId: pre.userId,
            type: "adjustment",
            amount: preTotal.toFixed(2),
            description: `Reservation deleted: ${pre.name}`,
            referenceId: pre.id,
            referenceType: "reservation_cancel",
            createdBy: user.id,
          });
        }

        // Delete reservation
        await db.delete(reservations).where(eq(reservations.id, id));

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );
}
