import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { reservations, users, societies, notifications, notificationMessages, type User, type Reservation, type Society } from "@shared/schema";
import { eq, and, gte, ne, desc, asc, count, sql, like, or, between } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { debtCalculationService } from "../cron-jobs";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

// Helper function to create reservation notifications
const createReservationNotification = async (
  userId: string,
  societyId: string,
  type: 'created' | 'cancelled' | 'confirmed',
  reservationData: any
) => {
  const reservationName = reservationData.name || 'erreserba';
  const reservationDate = new Date(reservationData.startDate).toLocaleDateString('eu-ES');
  
  let title, message;
  
  switch (type) {
    case 'cancelled':
      title = 'Erreserba ezeztatua';
      message = `Zure "${reservationName}" erreserba ezeztatu egin da. Data: ${reservationDate}.`;
      break;
    case 'confirmed':
      title = 'Erreserba konfirmatua';
      message = `Zure "${reservationName}" erreserba konfirmatua izan da. Data: ${reservationDate}.`;
      break;
    case 'created':
    default:
      title = 'Erreserba berria';
      message = `Zure "${reservationName}" erreserba ondo egin da. Data: ${reservationDate}.`;
      break;
  }
  
  // Create notification
  const notification = await db.insert(notifications).values({
    userId,
    societyId,
    title,
    message,
    isRead: false,
    defaultLanguage: 'eu',
  }).returning();

  // Create multilingual messages
  const messages = [];
  
  // Basque (default)
  messages.push({
    notificationId: notification[0].id,
    language: 'eu',
    title,
    message,
  });
  
  // Spanish
  const spanishTitle = type === 'cancelled' ? 'Reserva cancelada' : 
                      type === 'confirmed' ? 'Reserva confirmada' : 'Nueva reserva';
  const spanishMessage = type === 'cancelled' ? 
    `Tu reserva "${reservationName}" ha sido cancelada. Fecha: ${new Date(reservationData.startDate).toLocaleDateString('es-ES')}.` :
    type === 'confirmed' ? 
    `Tu reserva "${reservationName}" ha sido confirmada. Fecha: ${new Date(reservationData.startDate).toLocaleDateString('es-ES')}.` :
    `Tu reserva "${reservationName}" se ha realizado correctamente. Fecha: ${new Date(reservationData.startDate).toLocaleDateString('es-ES')}.`;
  
  messages.push({
    notificationId: notification[0].id,
    language: 'es',
    title: spanishTitle,
    message: spanishMessage,
  });
  
  // English
  const englishTitle = type === 'cancelled' ? 'Reservation cancelled' : 
                       type === 'confirmed' ? 'Reservation confirmed' : 'New reservation';
  const englishMessage = type === 'cancelled' ? 
    `Your "${reservationName}" reservation has been cancelled. Date: ${new Date(reservationData.startDate).toLocaleDateString('en-US')}.` :
    type === 'confirmed' ? 
    `Your "${reservationName}" reservation has been confirmed. Date: ${new Date(reservationData.startDate).toLocaleDateString('en-US')}.` :
    `Your "${reservationName}" reservation has been successfully made. Date: ${new Date(reservationData.startDate).toLocaleDateString('en-US')}.`;
  
  messages.push({
    notificationId: notification[0].id,
    language: 'en',
    title: englishTitle,
    message: englishMessage,
  });

  await db.insert(notificationMessages).values(messages);
  
  return notification[0];
};

export function registerReservationRoutes(app: Express) {
  // Reservations API
  app.get("/api/reservations", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      const { limit, month, user: userId, status, page = 1, search, type } = req.query;
      
      // Check if user is admin (administratzailea or diruzaina)
      const isAdmin = user.function === 'administratzailea' || user.function === 'diruzaina';
      
      // Parse pagination parameters
      const pageNum = parseInt(page as string, 10);
      const limitNum = limit ? parseInt(limit as string, 10) : 25;
      const offset = (pageNum - 1) * limitNum;
      
      // Validate pagination parameters
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ message: "Invalid page parameter" });
      }
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ message: "Invalid limit parameter (must be between 1 and 100)" });
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
          createdAt: reservations.createdAt,
          updatedAt: reservations.updatedAt,
          userName: users.name,
        })
        .from(reservations)
        .leftJoin(users, eq(reservations.userId, users.id));
      
      // Apply filters based on query parameters
      let conditions = [eq(reservations.societyId, societyId)];
      
      // Check if this request is for upcoming reservations only
      const upcomingOnly = req.query.upcoming === 'true';
      
      // For admin page or when not upcoming only: show all reservations (if admin)
      // For upcoming reservations page: only show future and confirmed reservations
      if (upcomingOnly || !isAdmin) {
        const now = new Date();
        conditions.push(gte(reservations.startDate, now));
        conditions.push(eq(reservations.status, 'confirmed'));
      }
      
      // Apply month filter
      if (month && typeof month === 'string' && month !== 'all') {
        let year, monthNum;
        
        // Handle both "YYYY-MM" and "MM" formats
        if (month.includes('-')) {
          // YYYY-MM format
          year = parseInt(month.split('-')[0]);
          monthNum = parseInt(month.split('-')[1]);
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
      if (userId && typeof userId === 'string' && userId !== 'all') {
        conditions.push(eq(reservations.userId, userId));
      }
      
      // Apply type filter
      if (type && typeof type === 'string' && type !== 'all') {
        conditions.push(eq(reservations.type, type));
      }
      
      // Apply search filter
      if (search && typeof search === 'string') {
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
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Reservations: get user's own reservations (including old and cancelled ones)
  app.get("/api/reservations/user", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
        return res.status(400).json({ message: "Invalid limit parameter (must be between 1 and 100)" });
      }
      
      let conditions = [
        eq(reservations.userId, user.id),
        eq(reservations.societyId, societyId)
      ];
      
      // Add status filter
      if (status && status !== 'all') {
        conditions.push(eq(reservations.status, status as string));
      }
      
      // Add type filter
      if (type && type !== 'all') {
        conditions.push(eq(reservations.type, type as string));
      }
      
      // Add month filter
      if (month && month !== 'all') {
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
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Error fetching user reservations:', error);
      res.status(500).json({ message: "Internal server error" });
      next(error);
    }
  });

  // Reservation statistics for dashboard
  app.get("/api/reservations/count", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
          count: count()
        })
        .from(reservations)
        .where(and(...conditions));
      
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reservations/sum", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
        return sum + parseFloat(reservation.totalAmount || '0');
      }, 0);
      
      res.json({ sum: totalSum });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reservations/guests-sum", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
  });

  app.get("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const societyId = getUserSocietyId(user);
      const reservation = await db.select().from(reservations)
        .where(and(
          eq(reservations.id, id),
          eq(reservations.societyId, societyId)
        ))
        .limit(1);
      
      if (!reservation.length) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Check access permissions
      if (reservation[0].userId !== user.id && !['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(reservation[0]);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reservations", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      
      // Convert startDate to Date if it's a string
      let startDate = req.body.startDate;
      if (typeof startDate === 'string') {
        startDate = new Date(startDate);
        // Validate the date
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
      }
      
      // Check if reservation date is in the past (ignoring time)
      const now = new Date();
      const reservationDate = new Date(startDate);
      
      // Reset time components to compare dates only
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selectedDate = new Date(reservationDate.getFullYear(), reservationDate.getMonth(), reservationDate.getDate());
      
      if (selectedDate < today) {
        return res.status(400).json({ message: "Reservations cannot be created for past dates" });
      }
      
      // Check if table is already reserved for the same date and event type (excluding cancelled reservations)
      const existingReservation = await db
        .select()
        .from(reservations)
        .where(and(
          eq(reservations.table, req.body.table),
          eq(reservations.startDate, startDate),
          eq(reservations.type, req.body.type),
          ne(reservations.status, 'cancelled')
        ))
        .limit(1);
      
      if (existingReservation.length > 0) {
        return res.status(400).json({ 
          message: `Table ${req.body.table} is already reserved for this date and event type` 
        });
      }
      
      const reservationData = {
        ...req.body,
        startDate,
        userId: user.id,
        societyId: societyId,
        status: 'confirmed',
      };
      
      
      const newReservation = await db.insert(reservations).values(reservationData).returning();
      
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
      await debtCalculationService.calculateCurrentMonthDebts();
      
      res.status(201).json({
        reservation: newReservation[0],
        reservations: updatedReservations || []
      });
    } catch (error) {
      console.error('Error creating reservation:', error);
      next(error);
    }
  });

  app.put("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { cancellationReason } = req.body as { cancellationReason?: string };
      const user = req.user!;
      
      const societyId = getUserSocietyId(user);
      const reservation = await db.select().from(reservations)
        .where(and(
          eq(reservations.id, id),
          eq(reservations.societyId, societyId)
        ))
        .limit(1);
      
      if (!reservation.length) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Check access permissions - users can only cancel their own reservations, but admins can cancel any
      console.error('CANCEL DEBUG - User ID:', user.id, 'User role:', user.role, 'User function:', user.function, 'Reservation user ID:', reservation[0].userId);
      if (user.function !== 'administratzailea' && reservation[0].userId !== user.id) {
        console.error('CANCEL DEBUG - Permission denied - not admin and not owner');
        return res.status(403).json({ message: "You can only cancel your own reservations" });
      }
      console.error('CANCEL DEBUG - Permission granted for cancellation');
      const isAdmin = ['administratzailea', 'diruzaina', 'sotolaria'].includes(user.function || '') ||
                      ['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '');
      // For admin cancelling someone else's reservation, a cancellation reason is required
      if (isAdmin && reservation[0].userId !== user.id) {
        if (!cancellationReason || !String(cancellationReason).trim()) {
          return res.status(400).json({ message: "Cancellation reason is required" });
        }
      }
      
      // Check if reservation can be cancelled (not already cancelled or completed)
      if (['cancelled', 'completed'].includes(reservation[0].status)) {
        return res.status(400).json({ message: "Reservation cannot be cancelled" });
      }
      
      // Update status to cancelled and store cancellation metadata
      const updatedReservation = await db.update(reservations)
        .set({
          status: 'cancelled',
          cancellationReason: cancellationReason ?? reservation[0].cancellationReason ?? null,
          cancelledBy: user.id,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, id))
        .returning();
      
      // Create cancellation notification for the user
      await createReservationNotification(
        reservation[0].userId,
        societyId,
        'cancelled',
        updatedReservation[0]
      );
      
      // Trigger real-time debt calculation for current month
      await debtCalculationService.calculateCurrentMonthDebts();
        
      res.json(updatedReservation[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const societyId = getUserSocietyId(user);
      const reservation = await db.select().from(reservations)
        .where(and(
          eq(reservations.id, id),
          eq(reservations.societyId, societyId)
        ))
        .limit(1);
      
      if (!reservation.length) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Check access permissions
      const isAdmin = ['administratzailea', 'diruzaina', 'sotolaria'].includes(user.function || '') ||
                     ['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '');
      
      if (reservation[0].userId !== user.id && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Create notification if admin is cancelling someone else's reservation
      if (reservation[0].userId !== user.id && isAdmin) {
        await createReservationNotification(
          reservation[0].userId,
          societyId,
          'cancelled',
          reservation[0]
        );
      }
      
      // Delete reservation
      await db.delete(reservations).where(eq(reservations.id, id));
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

}
