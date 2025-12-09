import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users, products, consumptions, consumptionItems, stockMovements, reservations, societies, type User, type Product, type Consumption, type ConsumptionItem, type StockMovement, type Reservation, type Society } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

// Helper function to get active society ID
const getActiveSocietyId = async (): Promise<string> => {
  const activeSociety = await db.select().from(societies).where(eq(societies.isActive, true)).limit(1);
  if (activeSociety.length === 0) {
    // If no active society, get the first one
    const firstSociety = await db.select().from(societies).limit(1);
    if (firstSociety.length === 0) {
      throw new Error('No societies found in database. Please seed societies first.');
    }
    return firstSociety[0].id;
  }
  return activeSociety[0].id;
};

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
      const activeSocietyId = await getActiveSocietyId();
      const [created] = await db
        .insert(users)
        .values({ 
          username: username.toLowerCase(), 
          password: hashedPassword,
          societyId: activeSocietyId,
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

      // Update session with new user data
      const sessionId = req.headers.authorization?.replace('Bearer ', '');
      if (sessionId) {
        const currentSession = sessions.get(sessionId);
        if (currentSession) {
          currentSession.user = updatedUser;
        }
      }
      
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

      // Update session with new password
      const sessionId = req.headers.authorization?.replace('Bearer ', '');
      if (sessionId) {
        const currentSession = sessions.get(sessionId);
        if (currentSession) {
          currentSession.user.password = newPassword;
        }
      }

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
      const activeSocietyId = await getActiveSocietyId();
      const allProducts = await db.select().from(products).where(eq(products.societyId, activeSocietyId));
      return res.status(200).json(allProducts);
    } catch (err) {
      next(err);
    }
  });

  // Products: get product by id
  app.get("/api/products/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const activeSocietyId = await getActiveSocietyId();
      const product = await db.select().from(products)
        .where(and(
          eq(products.id, id),
          eq(products.societyId, activeSocietyId)
        ))
        .limit(1);
      
      if (!product.length) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(200).json(product[0]);
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
      const activeSocietyId = await getActiveSocietyId();
      
      // Auto-assign the active society ID
      const [newProduct] = await db.insert(products).values({
        ...productData,
        societyId: activeSocietyId,
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
      const activeSocietyId = await getActiveSocietyId();
      const consumptionData = {
        ...req.body,
        userId: user.id,
        societyId: activeSocietyId,
      };
      
      const [newConsumption] = await db.insert(consumptions).values(consumptionData).returning();
      
      return res.status(201).json(newConsumption);
    } catch (err) {
      next(err);
    }
  });

  // Consumptions: get all consumptions (admin) or user's consumptions
  app.get("/api/consumptions", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const activeSocietyId = await getActiveSocietyId();
      
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
          .where(eq(consumptions.societyId, activeSocietyId));
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
            eq(consumptions.societyId, activeSocietyId)
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
      const activeSocietyId = await getActiveSocietyId();
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
          eq(consumptions.societyId, activeSocietyId)
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

  // Consumption Items: add items to consumption
  app.post("/api/consumptions/:id/items", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { items } = req.body; // Array of { productId, quantity, notes }
      
      // Verify consumption exists and user has access
      const activeSocietyId = await getActiveSocietyId();
      const consumption = await db.select().from(consumptions)
        .where(and(
          eq(consumptions.id, id),
          eq(consumptions.societyId, activeSocietyId)
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
        const activeSocietyId = await getActiveSocietyId();
        await db.insert(stockMovements).values({
          productId: item.productId,
          societyId: activeSocietyId,
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
      
      const activeSocietyId = await getActiveSocietyId();
      const consumption = await db.select().from(consumptions)
        .where(and(
          eq(consumptions.id, id),
          eq(consumptions.societyId, activeSocietyId)
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

  // Reservations API
  app.get("/api/reservations", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const activeSocietyId = await getActiveSocietyId();
      
      // Users can see their own reservations, admins can see all
      let reservationsList;
      if (['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        reservationsList = await db.select().from(reservations).where(eq(reservations.societyId, activeSocietyId));
      } else {
        reservationsList = await db.select().from(reservations)
          .where(and(
            eq(reservations.userId, user.id),
            eq(reservations.societyId, activeSocietyId)
          ));
      }
      
      res.json(reservationsList);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const activeSocietyId = await getActiveSocietyId();
      const reservation = await db.select().from(reservations)
        .where(and(
          eq(reservations.id, id),
          eq(reservations.societyId, activeSocietyId)
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
      const activeSocietyId = await getActiveSocietyId();
      
      const reservationData = {
        ...req.body,
        userId: user.id,
        societyId: activeSocietyId,
        status: 'pending',
        totalAmount: '0',
        depositAmount: '0',
      };
      
      const newReservation = await db.insert(reservations).values(reservationData).returning();
      res.status(201).json(newReservation[0]);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const activeSocietyId = await getActiveSocietyId();
      const reservation = await db.select().from(reservations)
        .where(and(
          eq(reservations.id, id),
          eq(reservations.societyId, activeSocietyId)
        ))
        .limit(1);
      
      if (!reservation.length) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Check access permissions
      if (reservation[0].userId !== user.id && !['administratzailea', 'diruzaina', 'sotolaria'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedReservation = await db.update(reservations)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();
        
      res.json(updatedReservation[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/reservations/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      const activeSocietyId = await getActiveSocietyId();
      const reservation = await db.select().from(reservations)
        .where(and(
          eq(reservations.id, id),
          eq(reservations.societyId, activeSocietyId)
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

  // Society management routes
  app.get("/api/societies", requireAuth, async (req, res, next) => {
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
      
      const user = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
      
      if (user.length === 0 || !user[0].societyId) {
        return res.status(404).json({ message: "User society not found" });
      }
      
      const society = await db.select().from(societies).where(eq(societies.id, user[0].societyId)).limit(1);
      
      if (society.length === 0) {
        return res.status(404).json({ message: "Society not found" });
      }
      
      res.json(society[0]);
    } catch (error) {
      console.error('Error in /api/societies/user:', error);
      next(error);
    }
  });

  app.get("/api/societies/:id", requireAuth, async (req, res, next) => {
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
      const { name, iban, creditorId, address, phone, email } = req.body;
      
      const [updatedSociety] = await db
        .update(societies)
        .set({ 
          name, 
          iban, 
          creditorId, 
          address, 
          phone, 
          email,
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

  return httpServer;
}
