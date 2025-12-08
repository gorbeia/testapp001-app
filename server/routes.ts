import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

// Simple session storage (in production, use Redis or proper session store)
const sessions = new Map<string, { user: User; timestamp: number }>();

// Session middleware
const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return next();
  }

  const session = sessions.get(sessionId);
  if (session && Date.now() - session.timestamp < 24 * 60 * 60 * 1000) { // 24 hour expiry
    req.user = session.user;
    session.timestamp = Date.now(); // Update timestamp
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Apply session middleware to all routes
  app.use(sessionMiddleware);

  // Authentication: login using database-backed users table
  app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const dbUser = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.username, email.toLowerCase()),
      });

      if (!dbUser) {
        return res.status(401).json({ message: "Invalid credentials" });
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

      // Create a simple session token
      const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessions.set(sessionId, {
        user: dbUser,
        timestamp: Date.now()
      });

      // Return user data and session token
      const { password: _, ...userWithoutPassword } = dbUser;
      return res.status(200).json({ 
        user: userWithoutPassword,
        token: sessionId
      });
    } catch (err) {
      next(err);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.headers.authorization?.replace('Bearer ', '');
      if (sessionId) {
        sessions.delete(sessionId);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Users: list all users from the database (admin only)
  app.get("/api/users", requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const allUsers = await db.query.users.findMany();
      // Remove passwords from response
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      return res.status(200).json(usersWithoutPasswords);
    } catch (err) {
      next(err);
    }
  });

  // Users: create a new user in the database (admin only)
  app.post("/api/users", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [created] = await db
        .insert(users)
        .values({ username: username.toLowerCase(), password: hashedPassword })
        .returning();

      return res.status(201).json(created);
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

      const result = await db.delete(users).where(eq(users.id, id)).returning();

      if (result.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return httpServer;
}
