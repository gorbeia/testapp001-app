import { createHash, randomBytes } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import {
  publicSocietySignupBodySchema,
  publicVerifyEmailQuerySchema,
  societies,
  users,
  userEmailVerifications,
} from "@shared/schema";
import type { CommunicationLanguage } from "@shared/schema";
import { getTenantApexDomainFromEnv } from "@shared/tenant-host";
import {
  societySubdomainFieldSchema,
  backofficeCheckSubdomainQuerySchema,
} from "@shared/tenant-host";
import { deriveSocietyAcronym } from "@shared/society-acronym";
import { allocateUniqueAlphabeticId } from "../lib/society-provision";
import { createPublicSignupRateLimiter } from "../lib/public-signup-rate-limit";
import { sendSignupVerificationEmail, sendSignupWelcomeEmail } from "../lib/mail/signup-email";
import { isPostgresUniqueViolation } from "../lib/pg-errors";

const signupPostLimiter = createPublicSignupRateLimiter({ windowMs: 15 * 60 * 1000, max: 15 });
const checkSubLimiter = createPublicSignupRateLimiter({ windowMs: 60 * 1000, max: 40 });

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function tenantLoginUrl(subdomain: string | null, apex: string | null): string | null {
  if (!subdomain || !apex) return null;
  const secure = process.env.NODE_ENV === "production";
  return `${secure ? "https" : "http"}://${subdomain}.${apex}/sartu`;
}

export function registerPublicSignupRoutes(app: Express) {
  app.get(
    "/api/public/check-subdomain",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!checkSubLimiter(clientIp(req))) {
          return res.status(429).json({ message: "Too many requests" });
        }
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

        return res.status(200).json({
          available,
          reason: available ? undefined : ("taken" as const),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/public/society-signup",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!signupPostLimiter(clientIp(req))) {
          return res.status(429).json({ message: "Too many requests" });
        }

        const parsed = publicSocietySignupBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid signup payload",
            issues: parsed.error.flatten(),
          });
        }

        const apex = getTenantApexDomainFromEnv();
        let subdomainLabel: string | null = null;
        if (apex) {
          const sub = societySubdomainFieldSchema.safeParse(parsed.data.subdomain ?? "");
          if (!sub.success) {
            return res.status(400).json({
              message: "A valid subdomain is required for your organization URL",
              issues: sub.error.flatten(),
            });
          }
          subdomainLabel = sub.data;
        }

        const adminEmail = parsed.data.adminEmail.trim().toLowerCase();
        const existingUser = await db.query.users.findFirst({
          where: (u, { eq: e }) => e(u.username, adminEmail),
        });
        if (existingUser) {
          return res.status(409).json({ message: "Could not complete signup" });
        }

        if (subdomainLabel) {
          const taken = await db.query.societies.findFirst({
            where: (s, { eq: e }) => e(s.subdomain, subdomainLabel),
          });
          if (taken) {
            return res.status(409).json({ message: "Could not complete signup" });
          }
        }

        const lang: CommunicationLanguage = parsed.data.communicationLanguage ?? "eu";
        const hashedPassword = await bcrypt.hash(parsed.data.adminPassword, 10);

        let plainToken = "";
        let alphabeticIdOut = "";

        try {
          await db.transaction(async tx => {
            const alphabeticId = await allocateUniqueAlphabeticId(tx, parsed.data.societyName);
            const acronymRaw = parsed.data.acronym;
            const acronym =
              acronymRaw && acronymRaw.length > 0
                ? acronymRaw
                : deriveSocietyAcronym(parsed.data.societyName) || "?";

            const societyEmail =
              parsed.data.societyContactEmail?.trim().toLowerCase() ?? adminEmail;

            const [society] = await tx
              .insert(societies)
              .values({
                name: parsed.data.societyName.trim(),
                shortDescription: parsed.data.shortDescription?.trim() || null,
                acronym,
                alphabeticId,
                email: societyEmail,
                phone: parsed.data.societyPhone?.trim() || null,
                address: parsed.data.societyAddress?.trim() || null,
                subdomain: subdomainLabel,
                sepaMode: "disabled",
                isActive: true,
              })
              .returning();

            alphabeticIdOut = society.alphabeticId;

            const [user] = await tx
              .insert(users)
              .values({
                username: adminEmail,
                password: hashedPassword,
                name: parsed.data.adminName.trim(),
                societyId: society.id,
                accessRole: "admin",
                membershipType: "full_member",
                marketingOptIn: parsed.data.marketingOptIn,
                communicationLanguage: lang,
                emailVerifiedAt: null,
              })
              .returning();

            plainToken = randomBytes(32).toString("base64url");
            const tokenHash = createHash("sha256").update(plainToken).digest("hex");
            const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

            await tx.insert(userEmailVerifications).values({
              userId: user.id,
              tokenHash,
              expiresAt,
            });
          });
        } catch (err: unknown) {
          if (isPostgresUniqueViolation(err)) {
            return res.status(409).json({ message: "Could not complete signup" });
          }
          throw err;
        }

        try {
          await sendSignupVerificationEmail({
            to: adminEmail,
            language: lang,
            societyName: parsed.data.societyName.trim(),
            token: plainToken,
          });
        } catch (mailErr) {
          console.error("[public-signup] verification email failed:", mailErr);
        }

        return res.status(201).json({
          ok: true,
          alphabeticId: alphabeticIdOut,
          subdomain: subdomainLabel,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get("/api/public/verify-email", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = publicVerifyEmailQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid token",
          issues: parsed.error.flatten(),
        });
      }

      const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

      const [row] = await db
        .select()
        .from(userEmailVerifications)
        .where(
          and(
            eq(userEmailVerifications.tokenHash, tokenHash),
            gt(userEmailVerifications.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!row) {
        return res.status(400).json({ message: "Invalid or expired verification link" });
      }

      const userBefore = await db.query.users.findFirst({
        where: (u, { eq: e }) => e(u.id, row.userId),
      });
      if (!userBefore) {
        return res.status(400).json({ message: "Invalid verification link" });
      }

      if (userBefore.emailVerifiedAt) {
        await db.delete(userEmailVerifications).where(eq(userEmailVerifications.id, row.id));
        const societyEarly = await db.query.societies.findFirst({
          where: (s, { eq: e }) => e(s.id, userBefore.societyId),
        });
        return res.status(200).json({
          ok: true,
          alphabeticId: societyEarly?.alphabeticId,
          subdomain: societyEarly?.subdomain ?? null,
        });
      }

      await db.transaction(async tx => {
        await tx
          .update(users)
          .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, row.userId));
        await tx.delete(userEmailVerifications).where(eq(userEmailVerifications.id, row.id));
      });

      const society = await db.query.societies.findFirst({
        where: (s, { eq: e }) => e(s.id, userBefore.societyId),
      });

      const apex = getTenantApexDomainFromEnv();
      const lang = (userBefore.communicationLanguage ?? "eu") as CommunicationLanguage;
      const sub = society?.subdomain ?? null;

      try {
        await sendSignupWelcomeEmail({
          to: userBefore.username,
          language: lang,
          societyName: society?.name ?? "",
          alphabeticId: society?.alphabeticId ?? "",
          tenantLoginUrl: tenantLoginUrl(sub, apex),
        });
      } catch (mailErr) {
        console.error("[public-signup] welcome email failed:", mailErr);
      }

      return res.status(200).json({
        ok: true,
        alphabeticId: society?.alphabeticId,
        subdomain: society?.subdomain ?? null,
      });
    } catch (err) {
      next(err);
    }
  });
}
