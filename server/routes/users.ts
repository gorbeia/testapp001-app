import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, consumptions, reservations, credits, notes, type User } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sessionMiddleware, requireAuth, requireAdmin } from "./middleware";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// JWT Functions
const generateToken = (user: User) => {
  const { password: _, ...userWithoutPassword } = user;
  return jwt.sign(userWithoutPassword, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const setAuthCookie = (res: Response, token: string) => {
  res.cookie('auth-token', token, {
    httpOnly: true,    // Prevent XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // Prevent CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
};

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: User): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

// Middleware to validate user ID parameter
const validateUserId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  next();
};

export function registerUserRoutes(app: Express) {
  // Users: list all users from the database (admin only)
  app.get("/api/users", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      
      let whereCondition;
      if (status === 'active') {
        whereCondition = eq(users.isActive, true);
      } else if (status === 'inactive') {
        whereCondition = eq(users.isActive, false);
      } else {
        // 'all' or undefined - return all users
        whereCondition = undefined;
      }
      
      const allUsers = await db.query.users.findMany({
        where: whereCondition
      });
      // Remove passwords from response
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      return res.status(200).json(usersWithoutPasswords);
    } catch (err) {
      next(err);
    }
  });

  // Users: count users by status (authenticated users)
  app.get("/api/users/count", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      const { status } = req.query;
      
      // Filter users by status if provided
      let whereCondition = eq(users.societyId, societyId);
      if (status === 'active') {
        whereCondition = and(whereCondition, eq(users.isActive, true))!;
      } else if (status === 'inactive') {
        whereCondition = and(whereCondition, eq(users.isActive, false))!;
      }
      
      const userCount = await db
        .select({ count: count() })
        .from(users)
        .where(whereCondition);
      
      return res.status(200).json({ count: userCount[0]?.count || 0 });
    } catch (err) {
      next(err);
    }
  });

  // Users: create a new user in the database (admin only)
  app.post("/api/users", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, name, phone, iban, role, function: userFunction } = req.body as { 
        username?: string; 
        password?: string; 
        name?: string;
        phone?: string;
        iban?: string;
        role?: string;
        function?: string;
      };

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const societyId = getUserSocietyId(req.user!);
      const [created] = await db
        .insert(users)
        .values({ 
          username,
          password: hashedPassword,
          societyId,
          name: name || null,
          phone: phone || null,
          iban: iban || null,
          role: role || null,
          function: userFunction || null
        })
        .returning();

      return res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Users: update own profile (authenticated user only)
  app.put("/api/users/:id/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Users can only update their own profile
      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ message: "Forbidden: You can only update your own profile" });
      }

      const {
        name,
        phone,
        iban,
      } = req.body as {
        name?: string;
        phone?: string | null;
        iban?: string | null;
      };

      const updateData: Partial<typeof users.$inferInsert> = {};
      if (typeof name !== "undefined") updateData.name = name;
      if (typeof phone !== "undefined") updateData.phone = phone;
      if (typeof iban !== "undefined") updateData.iban = iban;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No updatable fields provided" });
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id));

      // Fetch the complete updated user
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update JWT with new user data
      const token = generateToken(updatedUser);
      setAuthCookie(res, token);
      
      // Transform username to email for frontend compatibility
      const responseUser = {
        ...updatedUser,
        email: updatedUser.username
      };
      
      return res.status(200).json(responseUser);
    } catch (err) {
      next(err);
    }
  });

  // Change password
  app.post("/api/change-password", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user!;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Verify current password (in a real app, you'd hash and compare)
      if (user.password !== currentPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Update password
      await db
        .update(users)
        .set({ password: newPassword })
        .where(eq(users.id, user.id));

      // Update JWT with new password (remove password from token for security)
      const userWithoutPassword = { ...user, password: newPassword };
      const token = generateToken(userWithoutPassword);
      setAuthCookie(res, token);

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Users: update an existing user (admin only)
  app.put("/api/users/:id", requireAdmin, validateUserId, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const {
        name,
        role,
        function: userFunction,
        phone,
        iban,
        linkedMemberId,
        linkedMemberName,
      } = req.body as {
        name?: string;
        role?: string;
        function?: string;
        phone?: string;
        iban?: string;
        linkedMemberId?: string | null;
        linkedMemberName?: string | null;
      };

      const updateData: Partial<typeof users.$inferInsert> = {};
      if (typeof name !== "undefined") updateData.name = name;
      if (typeof role !== "undefined") updateData.role = role;
      if (typeof userFunction !== "undefined") updateData.function = userFunction;
      if (typeof phone !== "undefined") updateData.phone = phone;
      if (typeof iban !== "undefined") updateData.iban = iban;
      if (typeof linkedMemberId !== "undefined") updateData.linkedMemberId = linkedMemberId;
      if (typeof linkedMemberName !== "undefined") updateData.linkedMemberName = linkedMemberName;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No updatable fields provided" });
      }

      // Always update the updatedAt timestamp
      updateData.updatedAt = new Date();

      const updated = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json(updated[0]);
    } catch (err) {
      next(err);
    }
  });

  // Users: delete a user by id (admin only)
  app.delete("/api/users/:id", requireAdmin, validateUserId, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check for dependencies before deletion
      const [
        consumptionsCount,
        reservationsCount,
        creditsCount,
        notesCount,
        markedAsPaidByCount
      ] = await Promise.all([
        db.select({ count: count() }).from(consumptions).where(eq(consumptions.userId, id)),
        db.select({ count: count() }).from(reservations).where(eq(reservations.userId, id)),
        db.select({ count: count() }).from(credits).where(eq(credits.memberId, id)),
        db.select({ count: count() }).from(notes).where(eq(notes.createdBy, id)),
        db.select({ count: count() }).from(credits).where(eq(credits.markedAsPaidBy, id)),
      ]);

      const dependencies = [];
      
      if (consumptionsCount[0]?.count > 0) {
        dependencies.push(`${consumptionsCount[0].count} kontsumo`);
      }
      if (reservationsCount[0]?.count > 0) {
        dependencies.push(`${reservationsCount[0].count} erreserba`);
      }
      if (creditsCount[0]?.count > 0) {
        dependencies.push(`${creditsCount[0].count} zorra/kreditu`);
      }
      if (notesCount[0]?.count > 0) {
        dependencies.push(`${notesCount[0].count} ohar`);
      }
      if (markedAsPaidByCount[0]?.count > 0) {
        dependencies.push(`${markedAsPaidByCount[0].count} ordainketa-markatze`);
      }

      if (dependencies.length > 0) {
        return res.status(400).json({ 
          message: "Ezin izan da erabiltzailea ezabatu",
          details: `Erabiltzaileak erlazionatutako datuak ditu: ${dependencies.join(', ')}. Lehenengo datu horiek ezabatu edo erabiltzailea desaktibatu.`,
          dependencies
        });
      }

      const result = await db.delete(users).where(eq(users.id, id)).returning();

      if (result.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Users: toggle user active status (admin only)
  app.patch("/api/users/:id/toggle-active", requireAdmin, validateUserId, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const [updatedUser] = await db
        .update(users)
        .set({ 
          isActive: !user.isActive,
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning();

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      return res.status(200).json(userWithoutPassword);
    } catch (err) {
      next(err);
    }
  });
}
