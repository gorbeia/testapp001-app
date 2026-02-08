import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { superadmins, societies } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Backoffice JWT Configuration
const BACKOFFICE_JWT_SECRET = process.env.BACKOFFICE_JWT_SECRET || 'backoffice-super-secret-jwt-key-change-in-production';
const BACKOFFICE_JWT_EXPIRES_IN = '7d';

const generateBackofficeToken = () => {
  return jwt.sign({ type: 'backoffice' }, BACKOFFICE_JWT_SECRET, { expiresIn: BACKOFFICE_JWT_EXPIRES_IN });
};

const setBackofficeCookie = (res: Response, token: string) => {
  res.cookie('backoffice-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearBackofficeCookie = (res: Response) => {
  res.clearCookie('backoffice-token');
};

const verifyBackofficeToken = (token: string): boolean => {
  try {
    const decoded = jwt.verify(token, BACKOFFICE_JWT_SECRET) as any;
    return decoded.type === 'backoffice';
  } catch {
    return false;
  }
};

// Middleware to require backoffice authentication
const requireBackoffice = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isBackoffice) {
    return res.status(401).json({ message: 'Backoffice authentication required' });
  }
  next();
};

// Backoffice session middleware (independent from normal auth)
const backofficeSessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.['backoffice-token'];
  if (token && verifyBackofficeToken(token)) {
    req.isBackoffice = true;
  }
  next();
};

export function registerBackofficeRoutes(app: Express) {
  // Backoffice / multisociety superadmin login
  // This is intentionally separate from the normal society-based login.
  // It validates credentials against the superadmins table.
  app.post("/api/backoffice/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        return res.status(400).json({
          message: "Email and password are required",
          requires: ['email', 'password']
        });
      }

      const dbSuperadmin = await db.query.superadmins.findFirst({
        where: (sa, { eq }) => eq(sa.email, email.toLowerCase()),
      });

      if (!dbSuperadmin || !dbSuperadmin.isActive) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password (supports both hashed and plain text for migration)
      let passwordValid = false;
      if (dbSuperadmin.password.startsWith('$2b$')) {
        passwordValid = await bcrypt.compare(password, dbSuperadmin.password);
      } else {
        // Plain text fallback (should be phased out)
        passwordValid = dbSuperadmin.password === password;
      }

      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Issue backoffice token
      const token = generateBackofficeToken();
      setBackofficeCookie(res, token);
      return res.status(200).json({ ok: true, expiresIn: BACKOFFICE_JWT_EXPIRES_IN });
    } catch (err) {
      next(err);
    }
  });

  // Backoffice logout
  app.post("/api/backoffice/logout", async (req: Request, res: Response, next: NextFunction) => {
    try {
      clearBackofficeCookie(res);
      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Backoffice endpoint to list all societies (protected)
  app.get('/api/backoffice/societies', requireBackoffice, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allSocieties = await db.query.societies.findMany();
      return res.status(200).json(allSocieties);
    } catch (err) {
      next(err);
    }
  });

  // Backoffice endpoint to create a society (protected)
  app.post('/api/backoffice/societies', requireBackoffice, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, iban, creditorId, address, phone, email, reservationPricePerMember, kitchenPricePerMember } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      // Generate alphabetic ID (similar to existing society creation logic)
      const alphabeticId = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 20);

      // Check if alphabetic ID already exists and make it unique
      let finalAlphabeticId = alphabeticId;
      let counter = 1;
      while (true) {
        const existing = await db.query.societies.findFirst({
          where: (s, { eq }) => eq(s.alphabeticId, finalAlphabeticId),
        });
        if (!existing) break;
        finalAlphabeticId = `${alphabeticId}-${counter}`;
        counter++;
      }

      // If this is the first society, make it active
      const existingSocieties = await db.query.societies.findMany();
      const isActive = existingSocieties.length === 0;

      const newSociety = await db.insert(societies).values({
        name,
        alphabeticId: finalAlphabeticId,
        iban: iban || null,
        creditorId: creditorId || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        reservationPricePerMember: reservationPricePerMember || "25.00",
        kitchenPricePerMember: kitchenPricePerMember || "10.00",
        isActive,
      }).returning();

      return res.status(201).json(newSociety[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Society with this name already exists' });
      }
      next(err);
    }
  });

  // Backoffice endpoint to list superadmins (protected)
  app.get('/api/backoffice/superadmins', requireBackoffice, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allSuperadmins = await db.query.superadmins.findMany({
        columns: { id: true, email: true, name: true, isActive: true, createdAt: true, updatedAt: true },
      });
      return res.status(200).json(allSuperadmins);
    } catch (err) {
      next(err);
    }
  });

  // Backoffice endpoint to create a superadmin (protected)
  app.post('/api/backoffice/superadmins', requireBackoffice, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
      if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, password, and name are required' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newSuperadmin = await db.insert(superadmins).values({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        isActive: true,
      }).returning({
        id: superadmins.id,
        email: superadmins.email,
        name: superadmins.name,
        isActive: superadmins.isActive,
        createdAt: superadmins.createdAt,
        updatedAt: superadmins.updatedAt,
      });

      return res.status(201).json(newSuperadmin[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Email already exists' });
      }
      next(err);
    }
  });

  // Backoffice endpoint to update a superadmin (protected)
  app.put('/api/backoffice/superadmins/:id', requireBackoffice, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { email, password, name, isActive } = req.body as { email?: string; password?: string; name?: string; isActive?: boolean };

      const updateData: any = { updatedAt: new Date() };
      if (email !== undefined) updateData.email = email.toLowerCase();
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password !== undefined && password !== '') {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updated = await db.update(superadmins)
        .set(updateData)
        .where(eq(superadmins.id, id))
        .returning({
          id: superadmins.id,
          email: superadmins.email,
          name: superadmins.name,
          isActive: superadmins.isActive,
          createdAt: superadmins.createdAt,
          updatedAt: superadmins.updatedAt,
        });

      if (!updated.length) {
        return res.status(404).json({ message: 'Superadmin not found' });
      }

      return res.status(200).json(updated[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Email already exists' });
      }
      next(err);
    }
  });

  // Backoffice endpoint to delete a superadmin (protected)
  app.delete('/api/backoffice/superadmins/:id', requireBackoffice, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(superadmins).where(eq(superadmins.id, id)).returning({ id: superadmins.id });
      if (!deleted.length) {
        return res.status(404).json({ message: 'Superadmin not found' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
}

export { backofficeSessionMiddleware };
