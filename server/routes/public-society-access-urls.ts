import { createHash } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "../db";
import { publicSocietyAccessUrlsBodySchema, societies, users } from "@shared/schema";
import { getTenantApexDomainFromEnv } from "@shared/tenant-host";
import { createPublicSignupRateLimiter } from "../lib/public-signup-rate-limit";
import { sendSocietyAccessUrlsEmail } from "../lib/mail/society-access-urls-email";

const ipLimiter = createPublicSignupRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const emailLimiter = createPublicSignupRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function emailBucketKey(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
}

export function registerPublicSocietyAccessUrlsRoutes(app: Express) {
  app.post(
    "/api/public/society-access-urls",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apex = getTenantApexDomainFromEnv();
        if (!apex) {
          return res.status(404).json({ message: "Not available" });
        }

        const parsed = publicSocietyAccessUrlsBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request",
            issues: parsed.error.flatten(),
          });
        }

        const lowerEmail = parsed.data.email.trim().toLowerCase();

        if (!ipLimiter(clientIp(req))) {
          return res.status(429).json({ message: "Too many requests" });
        }
        if (!emailLimiter(emailBucketKey(lowerEmail))) {
          return res.status(429).json({ message: "Too many requests" });
        }

        const rows = await db
          .select({
            societyId: societies.id,
            societyName: societies.name,
            subdomain: societies.subdomain,
            communicationLanguage: users.communicationLanguage,
          })
          .from(users)
          .innerJoin(societies, eq(users.societyId, societies.id))
          .where(
            and(
              eq(users.username, lowerEmail),
              eq(users.isActive, true),
              isNotNull(users.emailVerifiedAt),
              isNotNull(societies.subdomain),
              ne(societies.subdomain, "")
            )
          );

        const seen = new Set<string>();
        const items: { societyName: string; subdomain: string }[] = [];
        let firstLang: string | null | undefined;
        for (const r of rows) {
          const sub = r.subdomain?.trim();
          if (!sub || seen.has(r.societyId)) continue;
          seen.add(r.societyId);
          items.push({ societyName: r.societyName, subdomain: sub });
          if (firstLang == null) firstLang = r.communicationLanguage;
        }

        if (items.length > 0) {
          if (process.env.NODE_ENV !== "test") {
            console.info("[society-access-urls] sending email", {
              to: lowerEmail,
              count: items.length,
              mailLogToStdout: process.env.MAIL_LOG_TO_STDOUT,
            });
          }
          await sendSocietyAccessUrlsEmail({
            to: lowerEmail,
            communicationLanguage: firstLang,
            apex,
            items,
          });
        }

        return res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );
}
