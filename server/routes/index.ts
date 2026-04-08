import express, { type Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import {
  jwtUserPayloadSchema,
  loginBodySchema,
  type JwtSessionUser,
  type User,
} from "../../shared/schema";
import { i18nMiddleware } from "../lib/i18n";
import { toPublicUser } from "../lib/public-user";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = "15m"; // Reduced to 15 minutes for better security
const REFRESH_TOKEN_EXPIRES_IN = "7d"; // Refresh token lasts longer

// JWT Functions
export const generateToken = (user: User) => {
  return jwt.sign(toPublicUser(user), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const generateRefreshToken = (user: User) => {
  return jwt.sign(toPublicUser(user), JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie("auth-token", token, {
    httpOnly: true, // Prevent XSS
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // Prevent CSRF
    maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT_EXPIRES_IN)
  });
};

const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie("refresh-token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches REFRESH_TOKEN_EXPIRES_IN)
  });
};

const clearAuthCookie = (res: Response) => {
  res.clearCookie("auth-token");
  res.clearCookie("refresh-token");
};

const verifyToken = (token: string): JwtSessionUser | null => {
  try {
    const raw = jwt.verify(token, JWT_SECRET);
    if (typeof raw === "string") return null;
    const parsed = jwtUserPayloadSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

// No-cache middleware for sensitive endpoints
const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};

// JWT Authentication middleware
const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from cookie first, then from Authorization header
  const token = req.cookies?.["auth-token"] || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return next();
  }

  try {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  } catch (_error) {
    console.error("JWT verification error:", _error);
  }

  next();
};

// Extend Express Request type

declare global {
  namespace Express {
    interface Request {
      user?: JwtSessionUser;
      isBackoffice?: boolean;
    }
  }
}

// Helper function to get society ID from JWT (no DB query needed)
export const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

import { registerTableRoutes } from "./tables";
import { registerNoteRoutes } from "./notes";
import { registerNotificationRoutes } from "./notifications";
import { registerProductRoutes } from "./products";
import { registerStockMovementRoutes } from "./stock-movements";
import { registerStockReceiptRoutes } from "./stock-receipts";
import { registerStockTakeRoutes } from "./stock-takes";
import { registerConsumptionRoutes } from "./consumptions";
import { registerReservationRoutes } from "./reservations";
import { registerSocietyEventRoutes } from "./society-events";
import { registerSepaRoutes } from "./sepa";
import { registerDebtRoutes } from "./debts";
import { registerAccountMovementRoutes } from "./account-movements";
import { registerBankTransferRoutes } from "./bank-transfers";
import { registerSocietyAccountingRoutes } from "./society-accounting";
import { registerSocietyTransactionRoutes } from "./society-transactions";
import { registerSocietyRoutes } from "./societies";
import { registerUserRoutes } from "./users";
import { registerSubscriptionRoutes } from "./subscriptions";
import { registerCategoryRoutes } from "./categories";
import { registerBackofficeRoutes, backofficeSessionMiddleware } from "./backoffice";
import { registerCashSettlementRoutes } from "./cash-settlements";
import { registerPrepaymentLedgerStatusRoutes } from "./prepayment-ledger-status";
import { registerImageRoutes } from "./images";
import { getUploadsRoot } from "../lib/image-storage";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Apply session middleware to all routes
  app.use(sessionMiddleware);
  // Apply backoffice session middleware to all routes (independent)
  app.use(backofficeSessionMiddleware);
  // Apply i18n middleware to all routes
  app.use(i18nMiddleware);
  // Apply no-cache to all API routes
  app.use("/api", noCache);

  // Uploaded images (GET); upload/delete registered in registerImageRoutes
  app.use("/api/images", express.static(getUploadsRoot(), { index: false }));
  registerImageRoutes(app);

  // Register table routes
  registerTableRoutes(app);

  // Register note routes
  registerNoteRoutes(app);

  // Register notification routes
  registerNotificationRoutes(app);

  // Register product routes
  registerProductRoutes(app);
  registerStockMovementRoutes(app);
  registerStockReceiptRoutes(app);
  registerStockTakeRoutes(app);

  // Register consumption routes
  registerConsumptionRoutes(app);
  registerCashSettlementRoutes(app);
  registerPrepaymentLedgerStatusRoutes(app);

  // Register reservation routes
  registerReservationRoutes(app);
  registerSocietyEventRoutes(app);

  // Register SEPA routes
  registerSepaRoutes(app);

  // Register debt routes
  registerDebtRoutes(app);

  registerAccountMovementRoutes(app);
  registerBankTransferRoutes(app);
  registerSocietyAccountingRoutes(app);
  registerSocietyTransactionRoutes(app);

  // Register society routes
  registerSocietyRoutes(app);

  // Register user routes
  registerUserRoutes(app);

  // Register subscription routes
  registerSubscriptionRoutes(app);

  // Register category routes
  registerCategoryRoutes(app);

  // Register backoffice routes
  registerBackofficeRoutes(app);

  // Authentication: login using database-backed users table
  app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Email, password, and society ID are required",
          issues: parsed.error.flatten(),
        });
      }

      const { email, password, societyId } = parsed.data;

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
      if (dbUser.password.startsWith("$2b$")) {
        // Hashed password - use bcrypt compare
        passwordValid = await bcrypt.compare(password, dbUser.password);
      } else {
        // Plain text password - direct comparison (for backward compatibility)
        passwordValid = dbUser.password === password;
      }

      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create JWT token and refresh token, set in httpOnly cookies
      const token = generateToken(dbUser);
      const refreshToken = generateRefreshToken(dbUser);
      setAuthCookie(res, token);
      setRefreshCookie(res, refreshToken);

      return res.status(200).json({
        user: toPublicUser(dbUser),
        token,
        expiresIn: JWT_EXPIRES_IN,
      });
    } catch (err) {
      next(err);
    }
  });

  // Refresh token endpoint
  app.post("/api/refresh", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.["refresh-token"];

      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      // Verify refresh token
      const user = verifyToken(refreshToken);
      if (!user) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      // Check if user still exists and is active in database
      const dbUser = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, user.id),
      });

      if (!dbUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check if user is active (not disabled)
      if (!dbUser.isActive) {
        return res.status(401).json({ message: "User account is disabled" });
      }

      // Generate new access token
      const newToken = generateToken(dbUser);
      setAuthCookie(res, newToken);

      return res.status(200).json({
        user: toPublicUser(dbUser),
        token: newToken,
        expiresIn: JWT_EXPIRES_IN,
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
