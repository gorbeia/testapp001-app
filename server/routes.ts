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

  return httpServer;
}
