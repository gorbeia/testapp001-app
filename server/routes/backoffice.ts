import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import {
  superadmins,
  societies,
  backofficeCreateSocietyBodySchema,
  backofficeEmailTestBodySchema,
  backofficeLoginBodySchema,
  createSuperadminBodySchema,
  updateSuperadminBodySchema,
} from "../../shared/schema";
import {
  getOutboundEmailConfigSnapshot,
  verifyAndSendBackofficeTestEmail,
  BackofficeMailTestError,
} from "../lib/mail";
import { deriveSocietyAcronym } from "../../shared/society-acronym";
import {
  backofficeSocietySubdomainPatchBodySchema,
  backofficeCheckSubdomainQuerySchema,
  societySubdomainFieldSchema,
} from "../../shared/tenant-host";
import { eq } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { isPostgresUniqueViolation } from "../lib/pg-errors";

// Backoffice JWT Configuration
const BACKOFFICE_JWT_SECRET =
  process.env.BACKOFFICE_JWT_SECRET || "backoffice-super-secret-jwt-key-change-in-production";
const BACKOFFICE_JWT_EXPIRES_IN = "7d";

const generateBackofficeToken = () => {
  return jwt.sign({ type: "backoffice" }, BACKOFFICE_JWT_SECRET, {
    expiresIn: BACKOFFICE_JWT_EXPIRES_IN,
  });
};

const setBackofficeCookie = (res: Response, token: string) => {
  res.cookie("backoffice-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearBackofficeCookie = (res: Response) => {
  res.clearCookie("backoffice-token");
};

const backofficeJwtPayloadSchema = z.object({ type: z.literal("backoffice") });

const verifyBackofficeToken = (token: string): boolean => {
  try {
    const raw = jwt.verify(token, BACKOFFICE_JWT_SECRET);
    if (typeof raw === "string") return false;
    return backofficeJwtPayloadSchema.safeParse(raw).success;
  } catch {
    return false;
  }
};

// Middleware to require backoffice authentication
const requireBackoffice = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isBackoffice) {
    return res.status(401).json({ message: "Backoffice authentication required" });
  }
  next();
};

// Backoffice session middleware (independent from normal auth)
const backofficeSessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.["backoffice-token"];
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
      const parsed = backofficeLoginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Email and password are required",
          issues: parsed.error.flatten(),
          requires: ["email", "password"],
        });
      }

      const { email, password } = parsed.data;

      const dbSuperadmin = await db.query.superadmins.findFirst({
        where: (sa, { eq }) => eq(sa.email, email.toLowerCase()),
      });

      if (!dbSuperadmin || !dbSuperadmin.isActive) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password (supports both hashed and plain text for migration)
      let passwordValid = false;
      if (dbSuperadmin.password.startsWith("$2b$")) {
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

  // Outbound email config snapshot (no secrets)
  app.get(
    "/api/backoffice/email/status",
    requireBackoffice,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        return res.status(200).json(getOutboundEmailConfigSnapshot());
      } catch (err) {
        next(err);
      }
    }
  );

  // Send a single SMTP test message (verifies connection first)
  app.post(
    "/api/backoffice/email/test",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = backofficeEmailTestBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid payload",
            issues: parsed.error.flatten(),
          });
        }

        const status = getOutboundEmailConfigSnapshot();
        if (!status.readyForSmtp) {
          return res.status(400).json({
            message: "SMTP is not fully configured on the server",
            code: "NOT_CONFIGURED" as const,
            status,
          });
        }
        if (!status.emailEnabled) {
          return res.status(400).json({
            message: "EMAIL_ENABLED is false on the server",
            code: "EMAIL_DISABLED" as const,
            status,
          });
        }

        try {
          await verifyAndSendBackofficeTestEmail(parsed.data.to);
        } catch (err) {
          if (err instanceof BackofficeMailTestError) {
            return res.status(502).json({
              message: err.message,
              code: err.code,
              status,
            });
          }
          throw err;
        }

        return res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // Backoffice endpoint to list all societies (protected)
  app.get(
    "/api/backoffice/societies",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const allSocieties = await db.query.societies.findMany();
        return res.status(200).json(allSocieties);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/backoffice/societies/check-subdomain",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = backofficeCheckSubdomainQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid query",
            issues: parsed.error.flatten(),
          });
        }

        const normalized = societySubdomainFieldSchema.safeParse(parsed.data.value);
        if (!normalized.success) {
          return res.status(200).json({ available: false, reason: "invalid" as const });
        }

        const label = normalized.data;
        const existing = await db.query.societies.findFirst({
          where: (s, { eq: e }) => e(s.subdomain, label),
        });

        const excludeId = parsed.data.excludeId;
        const available = !existing || (excludeId !== undefined && existing.id === excludeId);

        return res
          .status(200)
          .json({ available, reason: available ? undefined : ("taken" as const) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    "/api/backoffice/societies/:id",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const parsed = backofficeSocietySubdomainPatchBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid payload",
            issues: parsed.error.flatten(),
          });
        }

        const existing = await db.query.societies.findFirst({
          where: (s, { eq: e }) => e(s.id, id),
        });
        if (!existing) {
          return res.status(404).json({ message: "Society not found" });
        }

        const [updated] = await db
          .update(societies)
          .set({
            subdomain: parsed.data.subdomain,
            updatedAt: new Date(),
          })
          .where(eq(societies.id, id))
          .returning();

        return res.status(200).json(updated);
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          return res.status(409).json({ message: "Subdomain is already in use" });
        }
        next(err);
      }
    }
  );

  // Backoffice endpoint to create a society (protected)
  app.post(
    "/api/backoffice/societies",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = backofficeCreateSocietyBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid society payload",
            issues: parsed.error.flatten(),
          });
        }

        const {
          name,
          shortDescription,
          acronym: acronymRaw,
          iban,
          creditorId,
          address,
          phone,
          email,
          reservationPricePerMember,
          kitchenPricePerMember,
          sepaMode,
          paymentMethods,
        } = parsed.data;

        const acronym =
          acronymRaw && acronymRaw.length > 0 ? acronymRaw : deriveSocietyAcronym(name) || "?";

        // Generate alphabetic ID (similar to existing society creation logic)
        const alphabeticId = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 20);

        // Check if alphabetic ID already exists and make it unique
        let finalAlphabeticId = alphabeticId;
        let counter = 1;
        // eslint-disable-next-line no-constant-condition
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

        const resPrice =
          reservationPricePerMember !== undefined && reservationPricePerMember !== null
            ? String(reservationPricePerMember)
            : "25.00";
        const kitPrice =
          kitchenPricePerMember !== undefined && kitchenPricePerMember !== null
            ? String(kitchenPricePerMember)
            : "10.00";

        const newSociety = await db
          .insert(societies)
          .values({
            name,
            shortDescription:
              shortDescription === undefined
                ? null
                : shortDescription === null || shortDescription.trim() === ""
                  ? null
                  : shortDescription.trim(),
            acronym,
            alphabeticId: finalAlphabeticId,
            iban: iban ?? null,
            creditorId: creditorId ?? null,
            address: address ?? null,
            phone: phone ?? null,
            email: email ?? null,
            reservationPricePerMember: resPrice,
            kitchenPricePerMember: kitPrice,
            sepaMode: sepaMode ?? "monthly",
            ...(paymentMethods !== undefined && paymentMethods !== null ? { paymentMethods } : {}),
            isActive,
          })
          .returning();

        return res.status(201).json(newSociety[0]);
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          return res.status(409).json({ message: "Society with this name already exists" });
        }
        next(err);
      }
    }
  );

  // Backoffice endpoint to list superadmins (protected)
  app.get(
    "/api/backoffice/superadmins",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const allSuperadmins = await db.query.superadmins.findMany({
          columns: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return res.status(200).json(allSuperadmins);
      } catch (err) {
        next(err);
      }
    }
  );

  // Backoffice endpoint to create a superadmin (protected)
  app.post(
    "/api/backoffice/superadmins",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createSuperadminBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Email, password, and name are required",
            issues: parsed.error.flatten(),
          });
        }

        const { email, password, name } = parsed.data;

        const hashedPassword = await bcrypt.hash(password, 10);
        const newSuperadmin = await db
          .insert(superadmins)
          .values({
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            isActive: true,
          })
          .returning({
            id: superadmins.id,
            email: superadmins.email,
            name: superadmins.name,
            isActive: superadmins.isActive,
            createdAt: superadmins.createdAt,
            updatedAt: superadmins.updatedAt,
          });

        return res.status(201).json(newSuperadmin[0]);
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          return res.status(409).json({ message: "Email already exists" });
        }
        next(err);
      }
    }
  );

  // Backoffice endpoint to update a superadmin (protected)
  app.put(
    "/api/backoffice/superadmins/:id",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const parsed = updateSuperadminBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid payload",
            issues: parsed.error.flatten(),
          });
        }

        const { email, password, name, isActive } = parsed.data;

        const hashedPassword =
          password !== undefined && password.length > 0
            ? await bcrypt.hash(password, 10)
            : undefined;

        const updateData = {
          updatedAt: new Date(),
          ...(email !== undefined ? { email: email.toLowerCase() } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(hashedPassword !== undefined ? { password: hashedPassword } : {}),
        } satisfies PgUpdateSetSource<typeof superadmins>;

        const updated = await db
          .update(superadmins)
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
          return res.status(404).json({ message: "Superadmin not found" });
        }

        return res.status(200).json(updated[0]);
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          return res.status(409).json({ message: "Email already exists" });
        }
        next(err);
      }
    }
  );

  // Backoffice endpoint to delete a superadmin (protected)
  app.delete(
    "/api/backoffice/superadmins/:id",
    requireBackoffice,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const deleted = await db
          .delete(superadmins)
          .where(eq(superadmins.id, id))
          .returning({ id: superadmins.id });
        if (!deleted.length) {
          return res.status(404).json({ message: "Superadmin not found" });
        }
        return res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );
}

export { backofficeSessionMiddleware };
