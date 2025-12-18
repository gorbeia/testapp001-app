import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, products, consumptions, consumptionItems, stockMovements, reservations, societies, credits, notes, tables, notifications, notificationMessages, type User, type Product, type Consumption, type ConsumptionItem, type StockMovement, type Reservation, type Society, type Credit, type Note, type Table, type Notification, type NotificationMessage, type InsertTable } from "@shared/schema";
import { eq, and, gte, ne, sum, between, sql, desc, count, inArray, like, or } from "drizzle-orm";
import { debtCalculationService } from "../cron-jobs";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// JWT Functions
const generateToken = (user: User) => {
  const { password: _, ...userWithoutPassword } = user;
  return jwt.sign(userWithoutPassword, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token: string): User | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as User;
  } catch (error) {
    return null;
  }
};

// Access control helpers
const hasTreasurerAccess = (user: User): boolean => {
  return user.function === 'diruzaina' || user.function === 'administratzailea';
};

// Set JWT cookie helper
const setAuthCookie = (res: Response, token: string) => {
  res.cookie('auth-token', token, {
    httpOnly: true,    // Prevent XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // Prevent CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
};

// Clear auth cookie helper
const clearAuthCookie = (res: Response) => {
  res.clearCookie('auth-token');
};

// No-cache middleware for sensitive endpoints
const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// JWT Authentication middleware
const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from cookie first, then from Authorization header
  const token = req.cookies?.['auth-token'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next();
  }

  try {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.error('JWT verification error:', error);
  }
  
  next();
};

// Role-based middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.function !== 'administratzailea') {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
};

const requireTreasurer = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasTreasurerAccess(req.user)) {
    return res.status(403).json({ message: "Treasurer access required" });
  }
  
  next();
};

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  next();
};

// Reusable validation middleware
const validateUserId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: "User id is required" });
  }
  next();
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Helper function to get society ID from JWT (no DB query needed)
export const getUserSocietyId = (user: User): string => {
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

import { registerTableRoutes } from "./tables";
import { registerNoteRoutes } from "./notes";
import { registerNotificationRoutes } from "./notifications";
import { registerProductRoutes } from "./products";
import { registerConsumptionRoutes } from "./consumptions";
import { registerReservationRoutes } from "./reservations";
import { registerSepaRoutes } from "./sepa";
import { registerDebtRoutes } from "./debts";
import { registerSocietyRoutes } from "./societies";
import { registerUserRoutes } from "./users";
import { registerSubscriptionRoutes } from "./subscriptions";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Apply session middleware to all routes
  app.use(sessionMiddleware);
  
  // Apply no-cache to all API routes
  app.use("/api", noCache);

  // Register table routes
  registerTableRoutes(app);
  
  // Register note routes
  registerNoteRoutes(app);
  
  // Register notification routes
  registerNotificationRoutes(app);
  
  // Register product routes
  registerProductRoutes(app);
  
  // Register consumption routes
  registerConsumptionRoutes(app);
  
  // Register reservation routes
  registerReservationRoutes(app);
  
  // Register SEPA routes
  registerSepaRoutes(app);
  
  // Register debt routes
  registerDebtRoutes(app);
  
  // Register society routes
  registerSocietyRoutes(app);
  
  // Register user routes
  registerUserRoutes(app);
  
  // Register subscription routes
  registerSubscriptionRoutes(app);

  // Authentication: login using database-backed users table
  app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, societyId } = req.body as { email?: string; password?: string; societyId?: string };

      if (!email || !password || !societyId) {
        return res.status(400).json({ message: "Email, password, and society ID are required" });
      }

      // Verify society exists by alphabeticId
      const society = await db.query.societies.findFirst({
        where: (s, { eq }) => eq(s.alphabeticId, societyId),
      });

      if (!society) {
        return res.status(401).json({ message: "Invalid society ID" });
      }

      const dbUser = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.username, email.toLowerCase()),
      });

      if (!dbUser) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify user belongs to the specified society
      if (dbUser.societyId !== society.id) {
        return res.status(401).json({ message: "User does not belong to this society" });
      }

      // Check if password is hashed (starts with $2b$) or plain text
      let passwordValid = false;
      if (dbUser.password.startsWith('$2b$')) {
        // Hashed password - use bcrypt compare
        passwordValid = await bcrypt.compare(password, dbUser.password);
      } else {
        // Plain text password - direct comparison (for backward compatibility)
        passwordValid = dbUser.password === password;
      }

      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create JWT token and set in httpOnly cookie
      const token = generateToken(dbUser);
      setAuthCookie(res, token);
      
      // Return user data and token (for backward compatibility)
      const { password: _, ...userWithoutPassword } = dbUser;
      return res.status(200).json({ 
        user: userWithoutPassword,
        token
      });
    } catch (err) {
      next(err);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    try {
      // Clear the httpOnly cookie
      clearAuthCookie(res);
      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return httpServer;
}
