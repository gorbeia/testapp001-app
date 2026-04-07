import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  credits,
  users,
  societies,
  type JwtSessionUser,
  sepaModeSchema,
  type SepaMode,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requirePermission } from "./middleware";
import { Permission } from "@shared/permissions";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

/** Parse YYYY-MM into { y, m } month 1-12. */
function parseMonthLabel(label: string): { y: number; m: number } | null {
  if (!MONTH_RE.test(label)) return null;
  const [ys, ms] = label.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function monthLabel(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Inclusive expansion from first YYYY-MM to last YYYY-MM. */
function expandMonthRange(from: string, to: string): string[] | null {
  const a = parseMonthLabel(from);
  const b = parseMonthLabel(to);
  if (!a || !b) return null;
  let y = a.y;
  let m = a.m;
  const startOrd = a.y * 12 + a.m;
  const endOrd = b.y * 12 + b.m;
  if (startOrd > endOrd) return null;
  const out: string[] = [];
  while (y * 12 + m <= endOrd) {
    out.push(monthLabel(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function sortUniqueMonths(months: string[]): string[] {
  const parsed = months.map(parseMonthLabel).filter(Boolean) as { y: number; m: number }[];
  const labels = Array.from(new Set(parsed.map(p => monthLabel(p.y, p.m))));
  labels.sort((x, y) => {
    const px = parseMonthLabel(x)!;
    const py = parseMonthLabel(y)!;
    return px.y * 12 + px.m - (py.y * 12 + py.m);
  });
  return labels;
}

function validateMonthsForSepaMode(mode: SepaMode, months: string[]): string | null {
  if (months.length === 0) return "At least one month is required";
  const sorted = sortUniqueMonths(months);
  if (sorted.length !== months.length) return "Duplicate months are not allowed";

  if (mode === "monthly") {
    if (sorted.length !== 1) return "Monthly SEPA export requires exactly one month";
    return null;
  }

  if (mode === "bimonthly") {
    if (sorted.length !== 2) return "Bimonthly SEPA export requires exactly two months";
    const a = parseMonthLabel(sorted[0])!;
    const b = parseMonthLabel(sorted[1])!;
    if (a.y !== b.y) return "Bimonthly period must be within the same calendar year";
    const low = Math.min(a.m, b.m);
    const high = Math.max(a.m, b.m);
    if (high - low !== 1) return "Bimonthly months must be consecutive";
    if (low % 2 !== 1) return "Bimonthly period must align with Jan–Feb, Mar–Apr, etc.";
    return null;
  }

  if (mode === "quarterly") {
    if (sorted.length !== 3) return "Quarterly SEPA export requires exactly three months";
    const a = parseMonthLabel(sorted[0])!;
    const b = parseMonthLabel(sorted[1])!;
    const c = parseMonthLabel(sorted[2])!;
    if (a.y !== b.y || b.y !== c.y) return "Quarterly period must be within the same calendar year";
    const ms = [a.m, b.m, c.m].sort((x, y) => x - y);
    const quarterStarts = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
    ];
    const ok = quarterStarts.some(q => q[0] === ms[0] && q[1] === ms[1] && q[2] === ms[2]);
    if (!ok) return "Months must form a full calendar quarter (Q1–Q4)";
    return null;
  }

  if (mode === "on_demand") {
    return null;
  }

  if (mode === "disabled") {
    return "SEPA is disabled for this society";
  }

  return "Invalid SEPA mode";
}

function parseMonthsFromQuery(req: Request): string[] | null {
  const month = req.query.month as string | undefined;
  const monthsParam = req.query.months as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  if (month && monthsParam) return null;
  if (month && (from || to)) return null;
  if (monthsParam && (from || to)) return null;
  if ((from && !to) || (!from && to)) return null;

  if (from && to) {
    return expandMonthRange(from, to);
  }

  if (monthsParam) {
    const parts = monthsParam
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (!parseMonthLabel(p)) return null;
    }
    return parts;
  }

  if (month) {
    if (!parseMonthLabel(month)) return null;
    return [month];
  }

  return null;
}

export function registerSepaRoutes(app: Express) {
  app.get(
    "/api/credits/sepa-export",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.SEPA_EXPORT),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);

        const [society] = await db
          .select({ sepaMode: societies.sepaMode })
          .from(societies)
          .where(eq(societies.id, societyId))
          .limit(1);

        if (!society) {
          return res.status(404).json({ message: "Society not found" });
        }

        const modeParsed = sepaModeSchema.safeParse(society.sepaMode || "monthly");
        const sepaMode: SepaMode = modeParsed.success ? modeParsed.data : "monthly";

        if (sepaMode === "disabled") {
          return res.status(403).json({ message: "SEPA export is disabled for this society" });
        }

        const months = parseMonthsFromQuery(req);
        if (!months || months.length === 0) {
          return res.status(400).json({
            message:
              "Provide month=YYYY-MM, months=YYYY-MM,YYYY-MM,... or from=YYYY-MM&to=YYYY-MM (inclusive)",
          });
        }

        const validationError = validateMonthsForSepaMode(sepaMode, months);
        if (validationError) {
          return res.status(400).json({ message: validationError });
        }

        const sortedMonths = sortUniqueMonths(months);

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
          .where(
            and(
              eq(credits.societyId, societyId),
              inArray(credits.month, sortedMonths),
              eq(credits.status, "pending")
            )
          );

        const byMember = new Map<
          string,
          {
            memberId: string;
            memberName: string;
            iban: string | null;
            amount: number;
            creditIds: string[];
          }
        >();

        for (const row of creditsData) {
          const amt = parseFloat(row.totalAmount || "0");
          const existing = byMember.get(row.memberId);
          if (existing) {
            existing.amount += amt;
            existing.creditIds.push(row.id);
          } else {
            byMember.set(row.memberId, {
              memberId: row.memberId,
              memberName: row.memberName || "",
              iban: row.userIban,
              amount: amt,
              creditIds: [row.id],
            });
          }
        }

        const sepaCredits = Array.from(byMember.values())
          .filter(r => r.amount > 0)
          .map(r => ({
            id: `agg:${r.memberId}:${sortedMonths.join("|")}`,
            memberId: r.memberId,
            memberName: r.memberName,
            iban: r.iban,
            amount: r.amount,
            selected: true,
            status: "pending" as const,
            creditIds: r.creditIds,
            months: sortedMonths,
          }));

        res.json(sepaCredits);
      } catch (error) {
        next(error);
      }
    }
  );
}
