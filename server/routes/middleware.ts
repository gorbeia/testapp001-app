import type { Request, Response, NextFunction } from "express";
import { jwtUserPayloadSchema, type JwtSessionUser } from "@shared/schema";
import { hasPermission, type AppPermission } from "@shared/permissions";
import jwt from "jsonwebtoken";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtSessionUser;
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

const verifyToken = (token: string): JwtSessionUser | null => {
  try {
    const raw = jwt.verify(token, JWT_SECRET);
    if (typeof raw === "string") return null;
    const parsed = jwtUserPayloadSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null;
  }
};

/** User must be authenticated and have at least one of the given permissions (OR). */
export const requirePermission =
  (...permissions: AppPermission[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const role = req.user.accessRole;
    const allowed = permissions.some(p => hasPermission(role, p));
    if (!allowed) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  next();
};
