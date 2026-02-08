import type { Request, Response, NextFunction } from "express";
import { type User } from "@shared/schema";
import jwt from "jsonwebtoken";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// JWT Authentication middleware
export const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
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

const verifyToken = (token: string): User | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as User;
  } catch (error) {
    return null;
  }
};

// Role-based middleware
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.function !== "administratzailea") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

export const requireTreasurer = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!hasTreasurerAccess(req.user)) {
    return res.status(403).json({ message: "Treasurer access required" });
  }

  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  next();
};

const hasTreasurerAccess = (user: User): boolean => {
  return user.function === "diruzaina" || user.function === "administratzailea";
};
