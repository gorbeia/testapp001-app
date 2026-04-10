import { createHash, randomBytes } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import {
  publicForgotPasswordBodySchema,
  publicResetPasswordBodySchema,
  users,
  userPasswordResets,
} from "@shared/schema";
import { getTenantApexDomainFromEnv, parseHostForTenant } from "@shared/tenant-host";
import { createPublicSignupRateLimiter } from "../lib/public-signup-rate-limit";
import { sendPasswordResetEmail } from "../lib/mail/reset-password-email";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const forgotIpLimiter = createPublicSignupRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const forgotEmailLimiter = createPublicSignupRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function emailBucketKey(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
}

export function registerPublicPasswordResetRoutes(app: Express) {
  app.post(
    "/api/public/forgot-password",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = publicForgotPasswordBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request",
            issues: parsed.error.flatten(),
          });
        }

        const { email, societyId: societyIdBody } = parsed.data;
        const lowerEmail = email.toLowerCase();

        if (!forgotIpLimiter(clientIp(req))) {
          return res.status(429).json({ message: "Too many requests" });
        }
        if (!forgotEmailLimiter(emailBucketKey(lowerEmail))) {
          return res.status(429).json({ message: "Too many requests" });
        }

        const apex = getTenantApexDomainFromEnv();
        const hostParsed = apex
          ? parseHostForTenant(req.get("host"), apex)
          : ({ kind: "apex" } as const);

        let society: Awaited<ReturnType<typeof db.query.societies.findFirst>>;

        if (hostParsed.kind === "tenant") {
          const byHost = await db.query.societies.findFirst({
            where: (s, { eq: e }) => e(s.subdomain, hostParsed.subdomain),
          });
          if (!byHost) {
            if (process.env.NODE_ENV !== "test") {
              console.info("[password-reset] skip: tenant host not found");
            }
            return res.status(200).json({ ok: true });
          }
          if (societyIdBody && byHost.alphabeticId !== societyIdBody) {
            if (process.env.NODE_ENV !== "test") {
              console.info("[password-reset] skip: society id mismatch with host");
            }
            return res.status(200).json({ ok: true });
          }
          society = byHost;
        } else {
          if (!societyIdBody?.trim()) {
            return res.status(400).json({
              message: "Society ID is required",
            });
          }
          society = await db.query.societies.findFirst({
            where: (s, { eq: e }) => e(s.alphabeticId, societyIdBody),
          });
          if (!society) {
            if (process.env.NODE_ENV !== "test") {
              console.info("[password-reset] skip: unknown society");
            }
            return res.status(200).json({ ok: true });
          }
        }

        if (!society) {
          return res.status(200).json({ ok: true });
        }

        const dbUser = await db.query.users.findFirst({
          where: (u, { eq: e }) => e(u.username, lowerEmail),
        });

        if (!dbUser || !dbUser.isActive || dbUser.societyId !== society.id) {
          if (process.env.NODE_ENV !== "test") {
            console.info("[password-reset] skip: no matching active user");
          }
          return res.status(200).json({ ok: true });
        }

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await db.delete(userPasswordResets).where(eq(userPasswordResets.userId, dbUser.id));
        await db.insert(userPasswordResets).values({
          userId: dbUser.id,
          tokenHash,
          expiresAt,
        });

        if (process.env.NODE_ENV !== "test") {
          console.info("[password-reset] sending email", {
            to: lowerEmail,
            societyId: society.alphabeticId,
            mailLogToStdout: process.env.MAIL_LOG_TO_STDOUT,
          });
        }

        await sendPasswordResetEmail({
          to: lowerEmail,
          communicationLanguage: dbUser.communicationLanguage,
          societyName: society.name,
          subdomain: society.subdomain ?? null,
          apex,
          token: rawToken,
        });

        return res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/public/reset-password",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = publicResetPasswordBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request",
            issues: parsed.error.flatten(),
          });
        }

        const { token, newPassword } = parsed.data;
        const tokenHash = createHash("sha256").update(token).digest("hex");

        const [row] = await db
          .select()
          .from(userPasswordResets)
          .where(
            and(eq(userPasswordResets.tokenHash, tokenHash), gt(userPasswordResets.expiresAt, new Date()))
          )
          .limit(1);

        if (!row) {
          return res.status(400).json({ message: "Invalid or expired reset link" });
        }

        const hashed = await bcrypt.hash(newPassword, 10);

        await db.transaction(async tx => {
          await tx
            .update(users)
            .set({ password: hashed, updatedAt: new Date() })
            .where(eq(users.id, row.userId));
          await tx.delete(userPasswordResets).where(eq(userPasswordResets.id, row.id));
        });

        return res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );
}
