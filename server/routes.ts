import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

      if (!dbUser || dbUser.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // For now we only confirm credentials; profile/roles are managed on the client.
      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Users: list all users from the database
  app.get("/api/users", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const allUsers = await db.query.users.findMany();
      return res.status(200).json(allUsers);
    } catch (err) {
      next(err);
    }
  });

  // Users: create a new user in the database
  app.post("/api/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const [created] = await db
        .insert(users)
        .values({ username: username.toLowerCase(), password })
        .returning();

      return res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Users: update an existing user
  app.put("/api/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "User id is required" });
      }

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

  // Users: delete a user by id
  app.delete("/api/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "User id is required" });
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

  return httpServer;
}
