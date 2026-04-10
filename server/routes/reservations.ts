import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  users,
  reservations,
  reservationServices,
  tables,
  notifications,
  notificationMessages,
  cancelReservationBodySchema,
  createReservationBodySchema,
  normalizeSocietyReservationMealTypes,
  reservationNotificationLabel,
  computeReservationServiceLineTotal,
  reservationServicePriceToDecimalString,
  reservationServiceDisplayLabel,
  RESERVATION_SERVICE_SLUG_KITCHEN,
  type JwtSessionUser,
  type Reservation,
  type ReservationServiceSnapshot,
  type SocietyReservationMealType,
} from "@shared/schema";
import { eq, and, or, like, gte, between, ne, count, desc, asc, sql, inArray } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { translateWithParams, formatDate, translations, getLanguageFromRequest } from "../lib/i18n";
import { getReservationBlockBySocietyEvents } from "../lib/reservation-society-events";
import { debtCalculationService } from "../cron-jobs";
import { reverseReservationLedgerOnCancel } from "../lib/ledger/ledger-service";
import {
  assertPrepaymentDebitAllowed,
  prepaymentFloorHttpBody,
} from "../lib/prepayment-ledger-floor";
import { canModerateReservations, canViewReservationRegistry } from "@shared/permissions";
import { queueUserNotificationEmail } from "../lib/mail";
import { ensureDefaultReservationServicesForSociety } from "../lib/reservation-services-defaults";
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
  type: "created" | "cancelled" | "confirmed",
  labelSource: Pick<Reservation, "name" | "type" | "table">,
  mealTypes: SocietyReservationMealType[]
) => {
  const reservationDate = new Date(reservationData.startDate);
  const nameEu = reservationNotificationLabel({
    legacyName: labelSource.name,
    type: labelSource.type,
    table: labelSource.table,
    mealTypes,
    language: "eu",
  });
  const nameEs = reservationNotificationLabel({
    legacyName: labelSource.name,
    type: labelSource.type,
    table: labelSource.table,
    mealTypes,
    language: "es",
  });
  const nameEn = reservationNotificationLabel({
    legacyName: labelSource.name,
    type: labelSource.type,
    table: labelSource.table,
    mealTypes,
    language: "en",
  });

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
          reservationName: nameEu,
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
      reservationName: nameEu,
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
      reservationName: nameEs,
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
      reservationName: nameEn,
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

  queueUserNotificationEmail({
    userId: reservationData.userId,
    notificationId: notification.id,
  });

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
        const forCalendar = req.query.forCalendar === "true" || req.query.forCalendar === "1";

        // Full registry view (admin + treasurer; cellarman keeps member-style filters)
        const isAdmin = canViewReservationRegistry(user.accessRole);

        if (
          forCalendar &&
          (!month || typeof month !== "string" || month === "all" || !month.includes("-"))
        ) {
          return res.status(400).json({ message: "forCalendar requires month=YYYY-MM" });
        }

        // Parse pagination parameters
        const pageNum = parseInt(page as string, 10);
        const limitNum = forCalendar
          ? Math.min(limit ? parseInt(limit as string, 10) : 500, 500)
          : limit
            ? parseInt(limit as string, 10)
            : 25;
        const offset = (pageNum - 1) * limitNum;

        // Validate pagination parameters
        if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({ message: "Invalid page parameter" });
        }
        if (forCalendar) {
          if (isNaN(limitNum) || limitNum < 1) {
            return res.status(400).json({ message: "Invalid limit parameter" });
          }
        } else if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
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
            selectedServices: reservations.selectedServices,
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
        // For upcoming=true (member/calendar clients): only future and confirmed reservations
        // forCalendar: month grid for any member — all statuses in that month, past included
        if ((upcomingOnly || !isAdmin) && !forCalendar) {
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

        // Add search filter (search by name, table, or member name)
        if (search) {
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
            selectedServices: reservations.selectedServices,
            notes: reservations.notes,
            createdAt: reservations.createdAt,
            updatedAt: reservations.updatedAt,
            userName: users.name,
          })
          .from(reservations)
          .leftJoin(users, eq(reservations.userId, users.id))
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
        if (reservation[0].userId !== user.id && !canModerateReservations(user.accessRole)) {
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

        const { startDate, selectedServiceIds, ...rest } = parsed.data;

        const societyRow = await db.query.societies.findFirst({
          where: (s, { eq: eqS }) => eqS(s.id, societyId),
        });
        if (!societyRow) {
          return res.status(404).json({ message: "Society not found" });
        }

        await ensureDefaultReservationServicesForSociety(
          db,
          societyId,
          societyRow.kitchenPricePerMember
        );
        const allowedMealIds = new Set(
          normalizeSocietyReservationMealTypes(societyRow.reservationMealTypes).map(m => m.id)
        );
        if (!allowedMealIds.has(rest.type)) {
          return res.status(400).json({
            message: "Invalid reservation meal type for this society",
            code: "invalid_reservation_meal_type",
          });
        }

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

        const tableRow = await db.query.tables.findFirst({
          where: and(eq(tables.societyId, societyId), eq(tables.name, rest.table)),
        });
        if (!tableRow || !tableRow.isActive) {
          return res.status(400).json({ message: "Invalid or inactive table" });
        }

        const guests = rest.guests ?? 0;
        if (!Number.isInteger(guests) || guests < 1) {
          return res.status(400).json({ message: "Guests must be a positive integer" });
        }

        const minCap = tableRow.minCapacity ?? 1;
        if (guests < minCap || guests > tableRow.maxCapacity) {
          return res.status(400).json({
            message: `Guest count must be between ${minCap} and ${tableRow.maxCapacity} for this table`,
          });
        }

        const [slotAgg] = await db
          .select({
            bookedSeats: sql<number>`coalesce(sum(${reservations.guests}), 0)`.mapWith(Number),
            bookingCount: sql<number>`count(*)::int`.mapWith(Number),
          })
          .from(reservations)
          .where(
            and(
              eq(reservations.societyId, societyId),
              eq(reservations.table, rest.table),
              eq(reservations.startDate, startDate),
              eq(reservations.type, rest.type),
              ne(reservations.status, "cancelled")
            )
          );

        const bookedSeats = slotAgg?.bookedSeats ?? 0;
        const bookingCount = slotAgg?.bookingCount ?? 0;

        if (tableRow.allowsPartialReservation) {
          if (bookedSeats + guests > tableRow.maxCapacity) {
            return res.status(400).json({
              message: `Not enough seats remaining on ${rest.table} for this date and meal type`,
            });
          }
        } else if (bookingCount > 0) {
          return res.status(400).json({
            message: `Table ${rest.table} is already reserved for this date and event type`,
          });
        }

        const lang = getLanguageFromRequest(req);
        const uniqueServiceIds = [...new Set(selectedServiceIds ?? [])];
        let resolvedServices: (typeof reservationServices.$inferSelect)[] = [];
        if (uniqueServiceIds.length > 0) {
          resolvedServices = await db
            .select()
            .from(reservationServices)
            .where(
              and(
                eq(reservationServices.societyId, societyId),
                eq(reservationServices.isActive, true),
                inArray(reservationServices.id, uniqueServiceIds)
              )
            );
          if (resolvedServices.length !== uniqueServiceIds.length) {
            return res.status(400).json({
              message: "One or more reservation services are invalid or inactive",
            });
          }
        }

        const reservationFixed = parseFloat(String(societyRow.reservationFixedFee ?? "0")) || 0;
        const reservationPrice =
          parseFloat(String(societyRow.reservationPricePerMember ?? "0")) || 0;
        const baseTotal = reservationFixed + reservationPrice * guests;

        const selectedSnapshots: ReservationServiceSnapshot[] = resolvedServices.map(row => {
          const fixedStr = reservationServicePriceToDecimalString(row.fixedPrice);
          const perStr = reservationServicePriceToDecimalString(row.pricePerMember);
          const lineTotal = computeReservationServiceLineTotal(
            row.fixedPrice,
            row.pricePerMember,
            guests
          );
          return {
            serviceId: row.id,
            slug: row.slug,
            label: reservationServiceDisplayLabel(row, lang),
            fixedPrice: fixedStr,
            pricePerMember: perStr,
            lineTotal,
          };
        });

        const servicesSum = selectedSnapshots.reduce(
          (acc, s) => acc + (parseFloat(s.lineTotal || "0") || 0),
          0
        );
        const totalAmountStr = (baseTotal + servicesSum).toFixed(2);

        const useKitchen = selectedSnapshots.some(s => s.slug === RESERVATION_SERVICE_SLUG_KITCHEN);

        const societyEventBlock = await getReservationBlockBySocietyEvents(
          societyId,
          {
            startDate,
            useKitchen,
            table: rest.table,
          },
          lang
        );
        if (societyEventBlock) {
          return res.status(409).json({ message: societyEventBlock.message });
        }

        const resTotalPreview = Math.max(0, parseFloat(totalAmountStr));
        const prepaymentCheck = await assertPrepaymentDebitAllowed(
          societyId,
          user.id,
          resTotalPreview
        );
        if (!prepaymentCheck.allowed) {
          return res.status(403).json(prepaymentFloorHttpBody(prepaymentCheck));
        }

        const reservationData = {
          ...rest,
          name: rest.name?.trim() ? rest.name.trim() : "",
          startDate,
          userId: user.id,
          societyId,
          status: "confirmed" as const,
          useKitchen,
          totalAmount: totalAmountStr,
          selectedServices: selectedSnapshots,
        };

        const newReservation = await db.insert(reservations).values(reservationData).returning();

        // Ledger charge deferred until after startDate (see DebtCalculationService) or cash double-entry

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
            selectedServices: reservations.selectedServices,
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

        if (!canModerateReservations(user.accessRole) && reservation[0].userId !== user.id) {
          return res.status(403).json({ message: "You can only cancel your own reservations" });
        }
        const isAdmin = canModerateReservations(user.accessRole);
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

        await reverseReservationLedgerOnCancel({
          societyId,
          pre: reservation[0],
          cancelledByUserId: user.id,
          cancelDescriptionPrefix: "Reservation cancelled:",
        });

        const societyNotify = await db.query.societies.findFirst({
          where: (s, { eq: eqS }) => eqS(s.id, societyId),
        });
        const mealTypesNotify = normalizeSocietyReservationMealTypes(
          societyNotify?.reservationMealTypes
        );

        // Create cancellation notification for the user
        await createReservationNotifications(
          updatedReservation[0],
          "cancelled",
          reservation[0],
          mealTypesNotify
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

        const isAdmin = canModerateReservations(user.accessRole);

        if (reservation[0].userId !== user.id && !isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Create notification if admin is cancelling someone else's reservation
        if (reservation[0].userId !== user.id && isAdmin) {
          const societyNotifyDel = await db.query.societies.findFirst({
            where: (s, { eq: eqS }) => eqS(s.id, societyId),
          });
          const mealTypesDel = normalizeSocietyReservationMealTypes(
            societyNotifyDel?.reservationMealTypes
          );
          await createReservationNotifications(
            reservation[0],
            "cancelled",
            reservation[0],
            mealTypesDel
          );
        }

        await reverseReservationLedgerOnCancel({
          societyId,
          pre: reservation[0],
          cancelledByUserId: user.id,
          cancelDescriptionPrefix: "Reservation deleted:",
        });

        // Delete reservation
        await db.delete(reservations).where(eq(reservations.id, id));

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );
}
