import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users, products, consumptions, consumptionItems, stockMovements, reservations, societies, credits, oharrak, type User, type Product, type Consumption, type ConsumptionItem, type StockMovement, type Reservation, type Society, type Credit, type Oharrak } from "@shared/schema";
import { eq, and, gte, ne, sum, between, sql, desc, count, inArray } from "drizzle-orm";
import { debtCalculationService } from "./cron-jobs";
import { getChatRooms, getChatRoomMessages, createChatRoom, createChatMessage } from "./chat-routes";

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
const hasAdminAccess = (user: User): boolean => {
  return user.function === 'administratzailea';
};

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Apply session middleware to all routes
  app.use(sessionMiddleware);
  
  // Apply no-cache to all API routes
  app.use("/api", noCache);

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

  // Users: Get available users for chat conversations
  app.get("/api/users/available-for-chat", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          username: users.username,
        })
        .from(users)
        .where(eq(users.societyId, societyId));
      
      // Remove current user from the list
      const availableUsers = allUsers.filter(u => u.id !== user.id);
      
      return res.status(200).json(availableUsers);
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
      
      // Since users table doesn't have isActive field, we count all users for now
      // TODO: Add isActive field to users table and enable status filtering
      const userCount = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.societyId, societyId));
      
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

  // Products: get all products
  app.get("/api/products", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const allProducts = await db.select().from(products).where(eq(products.societyId, societyId));
      return res.status(200).json(allProducts);
    } catch (err) {
      next(err);
    }
  });

// Products: create new product (admin only)
  app.post("/api/products", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      
      // Check if user is admin
      if (user.role !== 'bazkidea' || user.function !== 'administratzailea') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const productData = req.body;
      const societyId = getUserSocietyId(user);
      
      // Auto-assign the user's society ID
      const [newProduct] = await db.insert(products).values({
        ...productData,
        societyId,
      }).returning();
      
      return res.status(201).json(newProduct);
    } catch (err) {
      next(err);
    }
  });

  // Products: update product (admin only)
  app.put("/api/products/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Check if user is admin
      if (user.role !== 'bazkidea' || user.function !== 'administratzailea') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updateData = req.body;
      const [updatedProduct] = await db
        .update(products)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(200).json(updatedProduct);
    } catch (err) {
      next(err);
    }
  });

  // Products: delete product (admin only)
  app.delete("/api/products/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Check if user is admin
      if (user.role !== 'bazkidea' || user.function !== 'administratzailea') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const [deletedProduct] = await db
        .delete(products)
        .where(eq(products.id, id))
        .returning();
      
      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Consumptions: create new consumption session
  app.post("/api/consumptions", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      const consumptionData = {
        ...req.body,
        userId: user.id,
        societyId,
      };
      
      const [newConsumption] = await db.insert(consumptions).values(consumptionData).returning();
      
      // Trigger real-time debt calculation for current month
      console.log(`[CONSUMPTION-CREATED] Triggering debt calculation for user ${user.id}`);
      await debtCalculationService.calculateCurrentMonthDebts();
      
      return res.status(201).json(newConsumption);
    } catch (err) {
      next(err);
    }
  });

  // Consumptions: get user's own consumptions with filtering
  app.get("/api/consumptions/user", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { search, status, type, month } = req.query;
      const societyId = getUserSocietyId(user);
      
      let conditions = [
        eq(consumptions.userId, user.id),
        eq(consumptions.societyId, societyId)
      ];
      
      // Add status filter
      if (status && status !== 'all') {
        conditions.push(eq(consumptions.status, status as string));
      }
      
      // Add type filter
      if (type && type !== 'all') {
        conditions.push(eq(consumptions.type, type as string));
      }
      
      // Add month filter
      if (month && month !== 'all') {
        conditions.push(sql`EXTRACT(MONTH FROM ${consumptions.createdAt}) = ${month}`);
      }
      
      // Add search filter (search by notes or date)
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(or(
          like(consumptions.notes, searchTerm),
          like(consumptions.createdAt, searchTerm)
        ));
      }
      
      const userConsumptions = await db
        .select({
          id: consumptions.id,
          userId: consumptions.userId,
          eventId: consumptions.eventId,
          type: consumptions.type,
          status: consumptions.status,
          totalAmount: consumptions.totalAmount,
          notes: consumptions.notes,
          createdAt: consumptions.createdAt,
          closedAt: consumptions.closedAt,
          closedBy: consumptions.closedBy,
        })
        .from(consumptions)
        .where(and(...conditions))
        .orderBy(desc(consumptions.createdAt));
      
      res.json(userConsumptions);
    } catch (error) {
      console.error('Error fetching user consumptions:', error);
      res.status(500).json({ message: "Internal server error" });
      next(error);
    }
  });

  // Consumptions: get all consumptions (admin) or user's consumptions
  app.get("/api/consumptions", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      let allConsumptions;
      if (['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        // Admin can see all consumptions with user names
        allConsumptions = await db
          .select({
            id: consumptions.id,
            userId: consumptions.userId,
            userName: users.name,
            userUsername: users.username,
            eventId: consumptions.eventId,
            type: consumptions.type,
            status: consumptions.status,
            totalAmount: consumptions.totalAmount,
            notes: consumptions.notes,
            createdAt: consumptions.createdAt,
            closedAt: consumptions.closedAt,
            closedBy: consumptions.closedBy,
          })
          .from(consumptions)
          .leftJoin(users, eq(consumptions.userId, users.id))
          .where(eq(consumptions.societyId, societyId));
      } else {
        // Regular users can only see their own consumptions
        allConsumptions = await db
          .select({
            id: consumptions.id,
            userId: consumptions.userId,
            userName: users.name,
            userUsername: users.username,
            eventId: consumptions.eventId,
            type: consumptions.type,
            status: consumptions.status,
            totalAmount: consumptions.totalAmount,
            notes: consumptions.notes,
            createdAt: consumptions.createdAt,
            closedAt: consumptions.closedAt,
            closedBy: consumptions.closedBy,
          })
          .from(consumptions)
          .leftJoin(users, eq(consumptions.userId, users.id))
          .where(and(
            eq(consumptions.userId, user.id),
            eq(consumptions.societyId, societyId)
          ));
      }
      
      return res.status(200).json(allConsumptions);
    } catch (err) {
      next(err);
    }
  });

  // Consumptions: get consumption by ID with items
  app.get("/api/consumptions/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Get consumption with user info
      const societyId = getUserSocietyId(user);
      const consumptionData = await db
        .select({
          id: consumptions.id,
          userId: consumptions.userId,
          userName: users.name,
          userUsername: users.username,
          eventId: consumptions.eventId,
          type: consumptions.type,
          status: consumptions.status,
          totalAmount: consumptions.totalAmount,
          notes: consumptions.notes,
          createdAt: consumptions.createdAt,
          closedAt: consumptions.closedAt,
          closedBy: consumptions.closedBy,
        })
        .from(consumptions)
        .leftJoin(users, eq(consumptions.userId, users.id))
        .where(and(
          eq(consumptions.id, id),
          eq(consumptions.societyId, societyId)
        ))
        .limit(1);
      
      if (!consumptionData.length) {
        return res.status(404).json({ message: "Consumption not found" });
      }
      
      const consumption = consumptionData[0];
      
      // Check permissions
      if (consumption.userId !== user.id && !['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get consumption items with product info
      const items = await db
        .select({
          id: consumptionItems.id,
          consumptionId: consumptionItems.consumptionId,
          productId: consumptionItems.productId,
          productName: products.name,
          quantity: consumptionItems.quantity,
          unitPrice: consumptionItems.unitPrice,
          totalPrice: consumptionItems.totalPrice,
          notes: consumptionItems.notes,
          createdAt: consumptionItems.createdAt,
        })
        .from(consumptionItems)
        .leftJoin(products, eq(consumptionItems.productId, products.id))
        .where(eq(consumptionItems.consumptionId, id));
      
      return res.status(200).json({ consumption, items });
    } catch (err) {
      next(err);
    }
  });

  // Consumption Items: get items for a consumption
  app.get("/api/consumptions/:id/items", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      // Verify user has access to this consumption
      const consumption = await db.select().from(consumptions)
        .where(and(
          eq(consumptions.id, id),
          eq(consumptions.societyId, societyId),
          ['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '') 
            ? undefined 
            : eq(consumptions.userId, user.id)
        ))
        .limit(1);
      
      if (consumption.length === 0) {
        return res.status(404).json({ message: "Consumption not found or access denied" });
      }
      
      const items = await db
        .select({
          id: consumptionItems.id,
          consumptionId: consumptionItems.consumptionId,
          productId: consumptionItems.productId,
          quantity: consumptionItems.quantity,
          unitPrice: consumptionItems.unitPrice,
          totalPrice: consumptionItems.totalPrice,
          notes: consumptionItems.notes,
          productName: products.name,
        })
        .from(consumptionItems)
        .leftJoin(products, eq(consumptionItems.productId, products.id))
        .where(eq(consumptionItems.consumptionId, id));
      
      res.json(items);
    } catch (error) {
      console.error('Error fetching consumption items:', error);
      res.status(500).json({ message: "Internal server error" });
      next(err);
    }
  });

  // Consumption Items: add items to consumption
  app.post("/api/consumptions/:id/items", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { items } = req.body; // Array of { productId, quantity, notes }
      
      // Verify consumption exists and user has access
      const societyId = getUserSocietyId(user);
      const consumption = await db.select().from(consumptions)
        .where(and(
          eq(consumptions.id, id),
          eq(consumptions.societyId, societyId)
        ))
        .limit(1);
      
      if (!consumption.length) {
        return res.status(404).json({ message: "Consumption not found" });
      }
      
      if (consumption[0].userId !== user.id && !['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (consumption[0].status !== 'open') {
        return res.status(400).json({ message: "Consumption is closed" });
      }
      
      const addedItems = [];
      let totalAmount = parseFloat(consumption[0].totalAmount || '0');
      
      for (const item of items) {
        // Get product info
        const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        
        if (!product.length) {
          return res.status(404).json({ message: `Product ${item.productId} not found` });
        }
        
        const unitPrice = parseFloat(product[0].price);
        const totalPrice = unitPrice * item.quantity;
        
        // Create consumption item
        const [newItem] = await db.insert(consumptionItems).values({
          consumptionId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          totalPrice: totalPrice.toString(),
          notes: item.notes || null,
        }).returning();
        
        addedItems.push(newItem);
        totalAmount += totalPrice;
        
        // Update product stock
        const currentStock = parseInt(product[0].stock);
        const newStock = currentStock - item.quantity;
        
        // Allow negative stocks since consumption represents actual usage
        await db.update(products)
          .set({ stock: newStock.toString(), updatedAt: new Date() })
          .where(eq(products.id, item.productId));
        
        // Create stock movement
        const societyId = getUserSocietyId(user);
        await db.insert(stockMovements).values({
          productId: item.productId,
          societyId,
          type: 'consumption',
          quantity: -item.quantity,
          reason: 'Bar consumption',
          referenceId: id,
          previousStock: currentStock.toString(),
          newStock: newStock.toString(),
          createdBy: user.id,
        });
      }
      
      // Update consumption total
      await db.update(consumptions)
        .set({ totalAmount: totalAmount.toString() })
        .where(eq(consumptions.id, id));
      
      // Trigger real-time debt calculation for current month
      console.log(`[CONSUMPTION-ITEMS-ADDED] Triggering debt calculation for user ${user.id}, total: ${totalAmount}`);
      await debtCalculationService.calculateCurrentMonthDebts();
      
      return res.status(201).json({ items: addedItems, totalAmount: totalAmount.toString() });
    } catch (err) {
      next(err);
    }
  });

  // Consumptions: close consumption
  app.post("/api/consumptions/:id/close", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const societyId = getUserSocietyId(user);
      const consumption = await db.select().from(consumptions)
        .where(and(
          eq(consumptions.id, id),
          eq(consumptions.societyId, societyId)
        ))
        .limit(1);
      
      if (!consumption.length) {
        return res.status(404).json({ message: "Consumption not found" });
      }
      
      if (consumption[0].userId !== user.id && !['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (consumption[0].status !== 'open') {
        return res.status(400).json({ message: "Consumption already closed" });
      }
      
      const [updatedConsumption] = await db
        .update(consumptions)
        .set({ 
          status: 'closed', 
          closedAt: new Date(), 
          closedBy: user.id 
        })
        .where(eq(consumptions.id, id))
        .returning();
      
      return res.status(200).json(updatedConsumption);
    } catch (err) {
      next(err);
    }
  });

  // Consumption statistics for dashboard
  app.get("/api/consumptions/count", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate } = req.query;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      const conditions = [eq(consumptions.societyId, societyId)];
      
      if (startDate) {
        conditions.push(gte(consumptions.createdAt, new Date(startDate as string)));
      }
      
      const result = await db
        .select({
          count: count()
        })
        .from(consumptions)
        .where(and(...conditions));
      
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/consumptions/sum", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate } = req.query;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      const conditions = [eq(consumptions.societyId, societyId)];
      
      if (startDate) {
        conditions.push(gte(consumptions.createdAt, new Date(startDate as string)));
      }
      
      // Get all consumption items that match the date criteria
      const consumptionItemsQuery = db
        .select({
          consumptionId: consumptionItems.consumptionId,
          quantity: consumptionItems.quantity,
          unitPrice: consumptionItems.unitPrice,
        })
        .from(consumptionItems)
        .innerJoin(
          consumptions,
          eq(consumptionItems.consumptionId, consumptions.id)
        )
        .where(and(...conditions));
      
      const items = await consumptionItemsQuery;
      
      // Calculate total sum
      const totalSum = items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0'));
      }, 0);
      
      res.json({ sum: totalSum });
    } catch (error) {
      next(error);
    }
  });

  // Member consumption statistics for dashboard
  app.get("/api/consumptions/member/sum", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate } = req.query;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      const conditions = [eq(consumptions.societyId, societyId), eq(consumptions.userId, user.id)];
      
      if (startDate) {
        conditions.push(gte(consumptions.createdAt, new Date(startDate as string)));
      }
      
      // Get all consumption items that match the date criteria for this member
      const consumptionItemsQuery = db
        .select({
          consumptionId: consumptionItems.consumptionId,
          quantity: consumptionItems.quantity,
          unitPrice: consumptionItems.unitPrice,
        })
        .from(consumptionItems)
        .innerJoin(
          consumptions,
          eq(consumptionItems.consumptionId, consumptions.id)
        )
        .where(and(...conditions));
      
      const items = await consumptionItemsQuery;
      
      // Calculate total sum
      const totalSum = items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0'));
      }, 0);
      
      res.json({ sum: totalSum });
    } catch (error) {
      next(error);
    }
  });

  // Reservations API
  app.get("/api/reservations", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      // All users can see all reservations for the society (only future dates)
      const now = new Date();
      const reservationsList = await db
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
        .where(and(
          eq(reservations.societyId, societyId),
          gte(reservations.startDate, now),
          ne(reservations.status, 'cancelled')
        ))
        .orderBy(reservations.startDate);
      
      res.json(reservationsList);
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
      
      console.log('Request body:', req.body);
      console.log('startDate type:', typeof req.body.startDate);
      console.log('startDate value:', req.body.startDate);
      
      // Convert startDate to Date if it's a string
      let startDate = req.body.startDate;
      if (typeof startDate === 'string') {
        startDate = new Date(startDate);
        // Validate the date
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
      }
      
      // Check if reservation date is in the past
      const now = new Date();
      if (startDate < now) {
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
      
      console.log('Final reservation data:', reservationData);
      
      const newReservation = await db.insert(reservations).values(reservationData).returning();
      
      // Trigger real-time debt calculation for current month
      await debtCalculationService.calculateCurrentMonthDebts();
      
      res.status(201).json(newReservation[0]);
    } catch (error) {
      console.error('Error creating reservation:', error);
      next(error);
    }
  });

  app.put("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
      
      // Check access permissions - users can only cancel their own reservations
      if (reservation[0].userId !== user.id) {
        return res.status(403).json({ message: "You can only cancel your own reservations" });
      }
      
      // Check if reservation can be cancelled (not already cancelled or completed)
      if (['cancelled', 'completed'].includes(reservation[0].status)) {
        return res.status(400).json({ message: "Reservation cannot be cancelled" });
      }
      
      // Update status to cancelled
      const updatedReservation = await db.update(reservations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();
      
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
      if (reservation[0].userId !== user.id && !['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete reservation
      await db.delete(reservations).where(eq(reservations.id, id));
      
      res.status(204).send();
    } catch (error) {
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

  // Get debt data for SEPA export by month
  app.get("/api/credits/sepa-export", requireTreasurer, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month } = req.query;
      
      if (!month) {
        return res.status(400).json({ message: "Month parameter is required" });
      }
      
      console.log('SEPA export request for month:', month);
      
      // First, let's check if there are any credits at all
      const allCredits = await db.select().from(credits);
      console.log('Total credits in database:', allCredits.length);
      
      // Check credits for the specific month
      const monthCredits = await db.select().from(credits).where(eq(credits.month, month as string));
      console.log('Credits for month', month, ':', monthCredits.length);
      
      // Get all credits for the specified month with user information
      const creditsData = await db
        .select({
          id: credits.id,
          memberId: credits.memberId,
          memberName: users.name,
          totalAmount: credits.totalAmount,
          status: credits.status,
          userIban: users.iban,
        })
        .from(credits)
        .innerJoin(users, eq(credits.memberId, users.id))
        .where(and(
          eq(credits.month, month as string),
          eq(credits.status, 'pending') // Only include pending debts
        ));
      
      console.log('Credits data with user info:', creditsData.length);
      
      // Transform data for SEPA export
      const sepaCredits = creditsData.map(credit => ({
        id: credit.id,
        memberId: credit.memberId,
        memberName: credit.memberName,
        iban: credit.userIban, // Using user's IBAN
        amount: parseFloat(credit.totalAmount || '0'),
        selected: true, // Default to selected
        status: credit.status
      }));
      
      console.log('Final SEPA credits:', sepaCredits);
      res.json(sepaCredits);
    } catch (error) {
      next(error);
    }
  });

  // Society management routes
  app.get("/api/societies", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const allSocieties = await db.select().from(societies).orderBy(societies.createdAt);
      res.json(allSocieties);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/societies/active", requireAuth, async (req, res, next) => {
    try {
      const activeSociety = await db.select().from(societies).where(eq(societies.isActive, true)).limit(1);
      if (activeSociety.length === 0) {
        // If no active society, return the first one
        const firstSociety = await db.select().from(societies).limit(1);
        res.json(firstSociety[0] || null);
      } else {
        res.json(activeSociety[0]);
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/societies/user", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const societyId = getUserSocietyId(req.user);
      const society = await db.select().from(societies).where(eq(societies.id, societyId)).limit(1);
      
      if (society.length === 0) {
        return res.status(404).json({ message: "Society not found" });
      }
      
      res.json(society[0]);
    } catch (error) {
      console.error('Error in /api/societies/user:', error);
      next(error);
    }
  });

  app.get("/api/societies/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const society = await db.select().from(societies).where(eq(societies.id, id));
      
      if (society.length === 0) {
        return res.status(404).json({ message: "Society not found" });
      }
      
      res.json(society[0]);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/societies", requireAdmin, async (req, res, next) => {
    try {
      const societyData = req.body;
      
      // If this is the first society, make it active
      const existingSocieties = await db.select().from(societies);
      if (existingSocieties.length === 0) {
        societyData.isActive = true;
      }
      
      const [newSociety] = await db.insert(societies).values(societyData).returning();
      res.status(201).json(newSociety);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/societies/:id", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, iban, creditorId, address, phone, email, reservationPricePerMember, kitchenPricePerMember } = req.body;
      
      const [updatedSociety] = await db
        .update(societies)
        .set({ 
          name, 
          iban, 
          creditorId, 
          address, 
          phone, 
          email,
          reservationPricePerMember,
          kitchenPricePerMember,
          updatedAt: new Date() 
        })
        .where(eq(societies.id, id))
        .returning();
      
      if (!updatedSociety) {
        return res.status(404).json({ message: "Society not found" });
      }
      
      res.json(updatedSociety);
    } catch (error) {
      console.error('Error updating society:', error);
      next(error);
    }
  });

  app.post("/api/societies/:id/toggle", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Get current society
      const [currentSociety] = await db.select().from(societies).where(eq(societies.id, id));
      if (!currentSociety) {
        return res.status(404).json({ message: "Society not found" });
      }
      
      // If activating this society, deactivate all others first
      if (!currentSociety.isActive) {
        await db.update(societies).set({ isActive: false }).where(eq(societies.isActive, true));
      }
      
      // Toggle the society
      const [updatedSociety] = await db
        .update(societies)
        .set({ 
          isActive: !currentSociety.isActive,
          updatedAt: new Date()
        })
        .where(eq(societies.id, id))
        .returning();
      
      res.json(updatedSociety);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/societies/:id", requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Check if society exists
      const [existingSociety] = await db.select().from(societies).where(eq(societies.id, id));
      if (!existingSociety) {
        return res.status(404).json({ message: "Society not found" });
      }
      
      // Don't allow deletion of active society
      if (existingSociety.isActive) {
        return res.status(400).json({ message: "Cannot delete active society" });
      }
      
      await db.delete(societies).where(eq(societies.id, id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Helper function to calculate monthly debts
  const calculateMonthlyDebts = async (year: number, month: number) => {
    const monthString = month.toString().padStart(2, '0');
    const monthLabel = `${year}-${monthString}`;
    
    // Get active society
    const [activeSociety] = await db.select().from(societies).where(eq(societies.isActive, true));
    if (!activeSociety) {
      throw new Error('No active society found');
    }

    // Get all members
    const members = await db.select().from(users).where(eq(users.societyId, activeSociety.id));

    // Calculate start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

    for (const member of members) {
      // Calculate consumption amounts for the month
      const consumptionResults = await db
        .select({
          total: sum(consumptions.totalAmount).mapWith(Number)
        })
        .from(consumptions)
        .where(and(
          eq(consumptions.userId, member.id),
          eq(consumptions.societyId, activeSociety.id),
          gte(consumptions.createdAt, startDate),
          ne(consumptions.status, 'cancelled')
        ));

      const consumptionAmount = consumptionResults[0]?.total || 0;

      // Calculate reservation amounts for the month
      const reservationResults = await db
        .select({
          total: sum(reservations.totalAmount).mapWith(Number)
        })
        .from(reservations)
        .where(and(
          eq(reservations.userId, member.id),
          eq(reservations.societyId, activeSociety.id),
          gte(reservations.startDate, startDate),
          ne(reservations.status, 'cancelled')
        ));

      const reservationAmount = reservationResults[0]?.total || 0;

      // Calculate kitchen usage fees for reservations with kitchen
      const kitchenReservations = await db
        .select()
        .from(reservations)
        .where(and(
          eq(reservations.userId, member.id),
          eq(reservations.societyId, activeSociety.id),
          eq(reservations.useKitchen, true),
          gte(reservations.startDate, startDate),
          ne(reservations.status, 'cancelled')
        ));

      const kitchenAmount = kitchenReservations.length * Number(activeSociety.kitchenPricePerMember || 0);

      // Calculate total amount
      const totalAmount = consumptionAmount + reservationAmount + kitchenAmount;

      // Only process credits if member has actual debts
      if (totalAmount > 0) {
        // Check if credit already exists for this member and month
        const [existingCredit] = await db
          .select()
          .from(credits)
          .where(and(
            eq(credits.memberId, member.id),
            eq(credits.societyId, activeSociety.id),
            eq(credits.month, monthLabel)
          ));

        if (existingCredit) {
          // Update existing credit
          await db
            .update(credits)
            .set({
              consumptionAmount: consumptionAmount.toString(),
              reservationAmount: reservationAmount.toString(),
              kitchenAmount: kitchenAmount.toString(),
              totalAmount: totalAmount.toString(),
              updatedAt: new Date()
            })
            .where(eq(credits.id, existingCredit.id));
        } else {
          // Create new credit
          await db.insert(credits).values({
            memberId: member.id,
            societyId: activeSociety.id,
            month: monthLabel,
            year,
            monthNumber: month,
            consumptionAmount: consumptionAmount.toString(),
            reservationAmount: reservationAmount.toString(),
            kitchenAmount: kitchenAmount.toString(),
            totalAmount: totalAmount.toString(),
            status: 'pending'
          });
        }
      }
    }

    return { message: `Calculated debts for ${monthLabel}` };
  };

  // Get current user's credits (authenticated users only)
  app.get("/api/credits/member/current", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      const { month, status } = req.query;
      const userId = req.user!.id;
      
      const conditions = [eq(credits.memberId, userId)];
      
      if (month) {
        conditions.push(eq(credits.month, month as string));
      }
      
      if (status && status !== 'all') {
        conditions.push(eq(credits.status, status as string));
      }
      
      let query = db.select().from(credits).where(and(...conditions));
      
      const userCredits = await query.orderBy(desc(credits.year), desc(credits.monthNumber));
      
      res.json(userCredits);
    } catch (error) {
      next(error);
    }
  });

  // Get credits for a member
  app.get("/api/credits/member/:memberId", requireAuth, async (req, res, next) => {
    try {
      const { memberId } = req.params;
      const user = req.user!;
      
      // Users can only see their own credits unless they have treasurer access
      if (memberId !== user.id && !hasTreasurerAccess(user)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const memberCredits = await db
        .select()
        .from(credits)
        .where(eq(credits.memberId, memberId))
        .orderBy(credits.year, credits.monthNumber);

      res.json(memberCredits);
    } catch (error) {
      next(error);
    }
  });

  // Get all credits (treasurer only)
  app.get("/api/credits", requireTreasurer, async (req, res, next) => {
    try {
      const { month, status } = req.query;
      
      const conditions = [];
      
      if (month) {
        conditions.push(eq(credits.month, month as string));
      }
      
      if (status) {
        conditions.push(eq(credits.status, status as string));
      }

      const baseQuery = db.select().from(credits);
      const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

      const allCredits = await query.orderBy(credits.year, credits.monthNumber, credits.memberId);
      
      // Get member names and payment tracking info
      const creditsWithNames = await Promise.all(
        allCredits.map(async (credit) => {
          const [member] = await db.select().from(users).where(eq(users.id, credit.memberId));
          let markedByUser = null;
          
          if (credit.markedAsPaidBy) {
            const [markedBy] = await db.select().from(users).where(eq(users.id, credit.markedAsPaidBy));
            markedByUser = markedBy?.name || null;
            if (!markedBy) {
              console.log(`User not found for markedAsPaidBy: ${credit.markedAsPaidBy} for credit ${credit.id}`);
            }
          } else if (credit.status === 'paid') {
            // Credit was marked as paid before tracking was implemented
            markedByUser = 'Ezezaguna (aurreko sistema)';
          }
          
          return {
            ...credit,
            memberName: member?.name || 'Unknown',
            markedByUser: markedByUser,
            markedByUserName: markedByUser
          };
        })
      );

      res.json(creditsWithNames);
    } catch (error) {
      next(error);
    }
  });

  // Get credits sum by status (for dashboard stats)
  app.get("/api/credits/sum", requireTreasurer, async (req, res, next) => {
    try {
      const { status } = req.query;
      
      const conditions = [];
      
      if (status && ['pending', 'paid', 'partial'].includes(status as string)) {
        conditions.push(eq(credits.status, status as string));
      }
      
      const result = await db
        .select({
          sum: sum(credits.totalAmount)
        })
        .from(credits)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const totalSum = result[0]?.sum || 0;
      
      res.json({ sum: parseFloat(totalSum.toString()) || 0 });
    } catch (error) {
      next(error);
    }
  });

  // Batch update credit status
  app.put("/api/credits/batch-status", requireTreasurer, async (req, res, next) => {
    try {
      const { creditIds, status } = req.body;

      if (!['pending', 'paid', 'partial'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      if (!Array.isArray(creditIds) || creditIds.length === 0) {
        return res.status(400).json({ message: "Invalid credit IDs" });
      }

      // Get all credits to validate and check current month restriction
      const creditsToUpdate = await db
        .select()
        .from(credits)
        .where(inArray(credits.id, creditIds));

      if (creditsToUpdate.length === 0) {
        return res.status(404).json({ message: "No credits found" });
      }

      // Check if any are for current month (only when marking as paid)
      if (status === 'paid') {
        const currentDate = new Date();
        const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const currentMonthCredits = creditsToUpdate.filter(credit => credit.month === currentMonthString);
        if (currentMonthCredits.length > 0) {
          return res.status(400).json({ 
            message: "Ezin da uneko hilabetea itxi. Itxaron hilabetea amaitu arte." 
          });
        }
      }

      // Update all credits
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      // Add payment tracking if marking as paid
      if (status === 'paid') {
        updateData.markedAsPaidBy = req.user!.id;
        updateData.markedAsPaidAt = new Date();
      }

      const updatedCredits = await db
        .update(credits)
        .set(updateData)
        .where(inArray(credits.id, creditIds))
        .returning();

      res.json({ 
        message: `Updated ${updatedCredits.length} credits`,
        updatedCredits 
      });
    } catch (error) {
      next(error);
    }
  });

  // Oharrak (Notes) routes - Admin only
  app.get("/api/oharrak", requireAuth, async (req, res, next) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const notes = await db.select().from(oharrak)
        .where(eq(oharrak.societyId, societyId))
        .orderBy(desc(oharrak.createdAt));
      res.json(notes);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/oharrak", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      const { title, content } = req.body;
      
      const [newNote] = await db.insert(oharrak).values({
        title,
        content,
        isActive: true,
        createdBy: req.user!.id,
        societyId,
      }).returning();
      
      res.status(201).json(newNote);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/oharrak/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { title, content, isActive } = req.body;
      const societyId = getUserSocietyId(req.user!);
      
      const [updatedNote] = await db
        .update(oharrak)
        .set({ 
          title, 
          content, 
          isActive,
          updatedAt: new Date()
        })
        .where(and(
          eq(oharrak.id, id),
          eq(oharrak.societyId, societyId)
        ))
        .returning();
      
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json(updatedNote);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/oharrak/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const societyId = getUserSocietyId(req.user!);
      
      const deletedNote = await db
        .delete(oharrak)
        .where(and(
          eq(oharrak.id, id),
          eq(oharrak.societyId, societyId)
        ))
        .returning();
      
      if (!deletedNote[0]) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Chat API endpoints
  app.get("/api/chat/rooms", requireAuth, getChatRooms);
  app.get("/api/chat/rooms/:roomId/messages", requireAuth, getChatRoomMessages);
  app.post("/api/chat/rooms", requireAuth, createChatRoom);
  app.post("/api/chat/rooms/:roomId/messages", requireAuth, createChatMessage);

  return httpServer;
}
