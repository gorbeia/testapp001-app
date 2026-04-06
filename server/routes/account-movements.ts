import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  accountMovements,
  accountMovementRefundBodySchema,
  accountMovementSepaBounceBodySchema,
  accountMovementTypeSchema,
  credits,
  users,
  type JwtSessionUser,
} from "@shared/schema";
import { and, eq, sql, asc } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { pool } from "../db";
import {
  assertBalanceAllowsMovement,
  getMemberAccountBalance,
  insertAccountMovementRow,
  movementExistsForReference,
  prepaidBlockedUserMessage,
} from "../lib/account-movements";
import { notifyFinancialEvent } from "../lib/financial-notifications";

const requireTreasurerAccess = (user: JwtSessionUser): boolean =>
  user.function === "diruzaina" || user.function === "administratzailea";

const requireTreasurer = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (!requireTreasurerAccess(req.user))
    return res.status(403).json({ message: "Treasurer access required" });
  next();
};

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
};

type MovementRow = typeof accountMovements.$inferSelect;

function attachRunningBalances(rows: MovementRow[]): (MovementRow & { runningBalance: number })[] {
  const sorted = [...rows].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  const byUser = new Map<string, number>();
  const out: (MovementRow & { runningBalance: number })[] = [];
  for (const r of sorted) {
    const prev = byUser.get(r.userId) ?? 0;
    const amt = parseFloat(String(r.amount));
    const next = prev + amt;
    byUser.set(r.userId, next);
    out.push({ ...r, runningBalance: next });
  }
  return out;
}

export function registerAccountMovementRoutes(app: Express) {
  app.get(
    "/api/account-movements",
    sessionMiddleware,
    requireTreasurer,
    async (req, res, next) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const userId = req.query.userId as string | undefined;
        const month = req.query.month as string | undefined;
        const typeRaw = req.query.type as string | undefined;
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
        const offset = (page - 1) * limit;

        const params: unknown[] = [societyId];
        let p = 2;
        let userClause = "";
        if (userId) {
          userClause = ` AND user_id = $${p}`;
          params.push(userId);
          p++;
        }
        let monthClause = "";
        if (month && /^\d{4}-\d{2}$/.test(month)) {
          monthClause = ` AND to_char(created_at, 'YYYY-MM') = $${p}`;
          params.push(month);
          p++;
        }
        let typeClause = "";
        if (typeRaw && typeRaw !== "all") {
          const parsedType = accountMovementTypeSchema.safeParse(typeRaw);
          if (parsedType.success) {
            typeClause = ` AND type = $${p}`;
            params.push(parsedType.data);
            p++;
          }
        }

        const countSql = `
          WITH base AS (
            SELECT m.*, SUM(m.amount::numeric) OVER (
              PARTITION BY m.user_id ORDER BY m.created_at ASC, m.id ASC
            ) AS running_balance
            FROM account_movements m
            WHERE m.society_id = $1
          )
          SELECT COUNT(*)::int AS c FROM base WHERE 1=1 ${userClause} ${monthClause} ${typeClause}
        `;
        const countRes = await pool.query(countSql, params);
        const total = countRes.rows[0]?.c ?? 0;

        const dataSql = `
          WITH base AS (
            SELECT m.*, SUM(m.amount::numeric) OVER (
              PARTITION BY m.user_id ORDER BY m.created_at ASC, m.id ASC
            ) AS running_balance
            FROM account_movements m
            WHERE m.society_id = $1
          )
          SELECT * FROM base
          WHERE 1=1 ${userClause} ${monthClause} ${typeClause}
          ORDER BY created_at DESC, id DESC
          LIMIT $${p} OFFSET $${p + 1}
        `;
        params.push(limit, offset);
        const dataRes = await pool.query(dataSql, params);
        type PgMov = {
          id: string;
          society_id: string;
          user_id: string;
          type: string;
          amount: string;
          description: string | null;
          reference_id: string | null;
          reference_type: string | null;
          created_by: string | null;
          created_at: Date;
          running_balance: string;
        };

        const withNames = await Promise.all(
          (dataRes.rows as PgMov[]).map(async m => {
            const [u] = await db
              .select({ name: users.name, username: users.username })
              .from(users)
              .where(and(eq(users.id, m.user_id), eq(users.societyId, societyId)));
            let createdByName: string | null = null;
            if (m.created_by) {
              const [cu] = await db
                .select({ name: users.name })
                .from(users)
                .where(and(eq(users.id, m.created_by), eq(users.societyId, societyId)));
              createdByName = cu?.name ?? null;
            }
            return {
              id: m.id,
              societyId: m.society_id,
              userId: m.user_id,
              type: m.type,
              amount: m.amount,
              description: m.description,
              referenceId: m.reference_id,
              referenceType: m.reference_type,
              createdBy: m.created_by,
              createdAt: m.created_at,
              runningBalance: parseFloat(String(m.running_balance ?? 0)),
              memberName: u?.name ?? null,
              memberUsername: u?.username ?? null,
              createdByName,
            };
          })
        );

        res.json({
          movements: withNames,
          total,
          page,
          limit,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  app.get(
    "/api/account-movements/me",
    sessionMiddleware,
    requireAuth,
    async (req, res, next) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);
        const month = req.query.month as string | undefined;
        const typeRaw = req.query.type as string | undefined;

        const conditions = [
          eq(accountMovements.societyId, societyId),
          eq(accountMovements.userId, user.id),
        ];
        if (month && /^\d{4}-\d{2}$/.test(month)) {
          conditions.push(sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') = ${month}`);
        }
        if (typeRaw && typeRaw !== "all") {
          const parsedType = accountMovementTypeSchema.safeParse(typeRaw);
          if (parsedType.success) {
            conditions.push(eq(accountMovements.type, parsedType.data));
          }
        }

        const rows = await db
          .select()
          .from(accountMovements)
          .where(and(...conditions))
          .orderBy(asc(accountMovements.createdAt), asc(accountMovements.id));

        const balance = await getMemberAccountBalance(societyId, user.id);
        const withRunning = attachRunningBalances(rows).sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        res.json({
          balance,
          movements: withRunning,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/api/account-movements/refund",
    sessionMiddleware,
    requireTreasurer,
    async (req, res, next) => {
      try {
        const parsed = accountMovementRefundBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
        }
        const societyId = getUserSocietyId(req.user!);
        const { userId, description } = parsed.data;
        const amountNum =
          typeof parsed.data.amount === "number"
            ? parsed.data.amount
            : parseFloat(String(parsed.data.amount));
        if (Number.isNaN(amountNum) || amountNum <= 0) {
          return res.status(400).json({ message: "Invalid amount" });
        }

        const [member] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, userId), eq(users.societyId, societyId)));
        if (!member) return res.status(404).json({ message: "User not found" });

        const movementAmountStr = amountNum.toFixed(2);
        const bal = await getMemberAccountBalance(societyId, userId);
        try {
          await assertBalanceAllowsMovement(societyId, userId, movementAmountStr, bal);
        } catch (err) {
          if (err instanceof Error && err.message === "PREPAID_NOT_ALLOWED") {
            return res.status(400).json({ message: prepaidBlockedUserMessage(req.headers) });
          }
          throw err;
        }

        const movement = await insertAccountMovementRow({
          societyId,
          userId,
          type: "refund",
          amount: movementAmountStr,
          description,
          referenceId: null,
          referenceType: null,
          createdBy: req.user!.id,
        });

        await notifyFinancialEvent({
          userId,
          societyId,
          referenceId: movement.id,
          titleKey: "financialRefundIssuedTitle",
          messageKey: "financialRefundIssuedMessage",
          params: { amount: amountNum.toFixed(2) },
        });

        res.status(201).json(movement);
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/api/account-movements/sepa-bounce",
    sessionMiddleware,
    requireTreasurer,
    async (req, res, next) => {
      try {
        const parsed = accountMovementSepaBounceBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
        }
        const societyId = getUserSocietyId(req.user!);
        const { creditId } = parsed.data;

        const [credit] = await db
          .select()
          .from(credits)
          .where(and(eq(credits.id, creditId), eq(credits.societyId, societyId)));
        if (!credit) return res.status(404).json({ message: "Credit not found" });
        if (credit.status !== "paid") {
          return res.status(400).json({ message: "Only paid credits can be reverted for SEPA bounce" });
        }

        const refKey = credit.id;
        if (await movementExistsForReference(societyId, "sepa_bounce", refKey)) {
          return res.status(400).json({ message: "Bounce already recorded for this credit" });
        }

        const amountNum = parseFloat(String(credit.totalAmount));
        const movement = await insertAccountMovementRow({
          societyId,
          userId: credit.memberId,
          type: "sepa_bounce",
          amount: (-amountNum).toFixed(2),
          description: `SEPA bounce — ${credit.month}`,
          referenceId: refKey,
          referenceType: "credit",
          createdBy: req.user!.id,
        });

        await db
          .update(credits)
          .set({
            status: "pending",
            markedAsPaidBy: null,
            markedAsPaidAt: null,
            updatedAt: new Date(),
          })
          .where(eq(credits.id, creditId));

        await notifyFinancialEvent({
          userId: credit.memberId,
          societyId,
          referenceId: movement.id,
          titleKey: "financialSepaBounceTitle",
          messageKey: "financialSepaBounceMessage",
          params: { month: credit.month },
        });

        res.status(201).json(movement);
      } catch (e) {
        next(e);
      }
    }
  );
}
