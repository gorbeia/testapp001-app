import type { Express, Request as ExpressRequest } from "express";
import { db } from "../db";
import {
  accountMovements,
  accountMovementRefundBodySchema,
  accountMovementSepaBounceBodySchema,
  accountMovementTypeSchema,
  credits,
  societies,
  users,
} from "@shared/schema";
import { Permission } from "@shared/permissions";
import { and, eq, sql, asc, inArray } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requirePermission } from "./middleware";
import { pool } from "../db";
import {
  getAllMemberBalances,
  getMemberAccountBalance,
  getMemberBalanceBeforeMonth,
} from "../lib/account-movements";
import { computeRunningBalancesWithInitial } from "../lib/ledger/ledger-rules";
import {
  bounceAlreadyRecorded,
  postLedgerRefund,
  postSepaBounceAndResetCredit,
} from "../lib/ledger/ledger-service";
import { notifyFinancialEvent } from "../lib/financial-notifications";

const getUserSocietyId = (user: { societyId: string }): string => {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
};

const MONTH_YM = /^\d{4}-\d{2}$/;

function parseStatementFromTo(req: ExpressRequest): { from: string; to: string } | null {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!MONTH_YM.test(from) || !MONTH_YM.test(to)) return null;
  if (from > to) return null;
  return { from, to };
}

async function buildAccountStatementJson(
  societyId: string,
  userId: string,
  from: string,
  to: string
) {
  const [member] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.societyId, societyId)));
  if (!member) return null;

  const [soc] = await db
    .select({ name: societies.name })
    .from(societies)
    .where(eq(societies.id, societyId));

  const openingBalance = await getMemberBalanceBeforeMonth(societyId, userId, from);
  const rows = await db
    .select()
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.societyId, societyId),
        eq(accountMovements.userId, userId),
        sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') >= ${from}`,
        sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') <= ${to}`
      )
    )
    .orderBy(asc(accountMovements.createdAt), asc(accountMovements.id));

  const withRunning = computeRunningBalancesWithInitial(rows, openingBalance);
  const periodNet = rows.reduce((s, r) => s + parseFloat(String(r.amount)), 0);
  const closingBalance = openingBalance + periodNet;

  const summaryMap = new Map<string, number>();
  for (const r of rows) {
    summaryMap.set(r.type, (summaryMap.get(r.type) ?? 0) + parseFloat(String(r.amount)));
  }
  const summary = Array.from(summaryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, total]) => ({ type, total: Number(total.toFixed(2)) }));

  let totalDebitsMag = 0;
  let totalCreditsSum = 0;
  for (const r of rows) {
    const a = parseFloat(String(r.amount));
    if (a < 0) totalDebitsMag += -a;
    else if (a > 0) totalCreditsSum += a;
  }

  return {
    period: { from, to },
    societyName: soc?.name ?? null,
    member: { id: member.id, name: member.name, username: member.username },
    openingBalance,
    closingBalance,
    totalDebits: Number(totalDebitsMag.toFixed(2)),
    totalCredits: Number(totalCreditsSum.toFixed(2)),
    movementCount: rows.length,
    generatedAt: new Date().toISOString(),
    summary,
    movements: withRunning.map(m => ({
      id: m.id,
      type: m.type,
      amount: m.amount,
      description: m.description,
      referenceId: m.referenceId,
      referenceType: m.referenceType,
      createdBy: m.createdBy,
      createdAt: m.createdAt.toISOString(),
      runningBalance: m.runningBalance,
    })),
  };
}

async function buildSocietyStatementJson(societyId: string, from: string, to: string) {
  const [soc] = await db
    .select({ name: societies.name })
    .from(societies)
    .where(eq(societies.id, societyId));

  const rows = await db
    .select()
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.societyId, societyId),
        sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') >= ${from}`,
        sql`to_char(${accountMovements.createdAt}, 'YYYY-MM') <= ${to}`
      )
    )
    .orderBy(asc(accountMovements.createdAt), asc(accountMovements.id));

  const userIds = Array.from(new Set(rows.map(r => r.userId)));
  const memberMap = new Map<string, { name: string | null; username: string }>();
  if (userIds.length > 0) {
    const memberRows = await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(and(eq(users.societyId, societyId), inArray(users.id, userIds)));
    for (const u of memberRows) {
      memberMap.set(u.id, { name: u.name, username: u.username });
    }
  }

  const summaryMap = new Map<string, number>();
  let totalDebitsMag = 0;
  let totalCreditsSum = 0;
  let periodNet = 0;
  for (const r of rows) {
    const a = parseFloat(String(r.amount));
    periodNet += a;
    if (a < 0) totalDebitsMag += -a;
    else if (a > 0) totalCreditsSum += a;
    summaryMap.set(r.type, (summaryMap.get(r.type) ?? 0) + a);
  }
  const summary = Array.from(summaryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, total]) => ({ type, total: Number(total.toFixed(2)) }));

  const movements = rows.map(r => {
    const m = memberMap.get(r.userId);
    const n = parseFloat(String(r.amount));
    return {
      id: r.id,
      memberName: m?.name ?? null,
      memberUsername: m?.username ?? "",
      type: r.type,
      amount: Number.isFinite(n) ? n.toFixed(2) : String(r.amount),
      description: r.description,
      referenceId: r.referenceId,
      referenceType: r.referenceType,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return {
    period: { from, to },
    societyName: soc?.name ?? null,
    movementCount: rows.length,
    totalDebits: Number(totalDebitsMag.toFixed(2)),
    totalCredits: Number(totalCreditsSum.toFixed(2)),
    periodNet: Number(periodNet.toFixed(2)),
    generatedAt: new Date().toISOString(),
    summary,
    movements,
  };
}

export function registerAccountMovementRoutes(app: Express) {
  app.get(
    "/api/account-movements",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const userId = req.query.userId as string | undefined;
        const month = req.query.month as string | undefined;
        const typeRaw = req.query.type as string | undefined;
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(
          100,
          Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50)
        );
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

        const filterParams = [...params];

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
        const countRes = await pool.query(countSql, filterParams);
        const total = countRes.rows[0]?.c ?? 0;

        const sumSql = `
          SELECT coalesce(sum(m.amount::numeric), 0) AS s
          FROM account_movements m
          WHERE m.society_id = $1${userClause} ${monthClause} ${typeClause}
        `;
        const sumRes = await pool.query(sumSql, filterParams);
        const sumAmount = parseFloat(String(sumRes.rows[0]?.s ?? 0));

        let selectedMemberBalance: number | null = null;
        if (userId) {
          selectedMemberBalance = await getMemberAccountBalance(societyId, userId);
        }

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
        const dataParams = [...filterParams, limit, offset];
        const dataRes = await pool.query(dataSql, dataParams);
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
          sumAmount,
          selectedMemberBalance,
          page,
          limit,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  app.get("/api/account-movements/me", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      const memberId = user.id;
      const month = req.query.month as string | undefined;
      const typeRaw = req.query.type as string | undefined;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
      const offset = (page - 1) * limit;

      const params: unknown[] = [societyId, memberId];
      let p = 3;
      let monthClauseBase = "";
      let monthClauseM = "";
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        monthClauseBase = ` AND to_char(created_at, 'YYYY-MM') = $${p}`;
        monthClauseM = ` AND to_char(m.created_at, 'YYYY-MM') = $${p}`;
        params.push(month);
        p++;
      }
      let typeClauseBase = "";
      let typeClauseM = "";
      if (typeRaw && typeRaw !== "all") {
        const parsedType = accountMovementTypeSchema.safeParse(typeRaw);
        if (parsedType.success) {
          typeClauseBase = ` AND type = $${p}`;
          typeClauseM = ` AND m.type = $${p}`;
          params.push(parsedType.data);
          p++;
        }
      }

      const filterParams = [...params];

      const countSql = `
        WITH base AS (
          SELECT m.*, SUM(m.amount::numeric) OVER (
            PARTITION BY m.user_id ORDER BY m.created_at ASC, m.id ASC
          ) AS running_balance
          FROM account_movements m
          WHERE m.society_id = $1 AND m.user_id = $2
        )
        SELECT COUNT(*)::int AS c FROM base WHERE 1=1 ${monthClauseBase} ${typeClauseBase}
      `;
      const countRes = await pool.query(countSql, filterParams);
      const total = countRes.rows[0]?.c ?? 0;

      const sumSql = `
        SELECT coalesce(sum(m.amount::numeric), 0) AS s
        FROM account_movements m
        WHERE m.society_id = $1 AND m.user_id = $2${monthClauseM} ${typeClauseM}
      `;
      const sumRes = await pool.query(sumSql, filterParams);
      const sumAmount = parseFloat(String(sumRes.rows[0]?.s ?? 0));

      const balance = await getMemberAccountBalance(societyId, memberId);

      const dataSql = `
        WITH base AS (
          SELECT m.*, SUM(m.amount::numeric) OVER (
            PARTITION BY m.user_id ORDER BY m.created_at ASC, m.id ASC
          ) AS running_balance
          FROM account_movements m
          WHERE m.society_id = $1 AND m.user_id = $2
        )
        SELECT * FROM base
        WHERE 1=1 ${monthClauseBase} ${typeClauseBase}
        ORDER BY created_at DESC, id DESC
        LIMIT $${p} OFFSET $${p + 1}
      `;
      const dataParams = [...filterParams, limit, offset];
      const dataRes = await pool.query(dataSql, dataParams);
      type PgMovMe = {
        id: string;
        type: string;
        amount: string;
        description: string | null;
        created_at: Date;
        running_balance: string;
      };

      const movements = (dataRes.rows as PgMovMe[]).map(m => ({
        id: m.id,
        type: m.type,
        amount: m.amount,
        description: m.description,
        createdAt: m.created_at.toISOString(),
        runningBalance: parseFloat(String(m.running_balance ?? 0)),
      }));

      res.json({
        balance,
        movements,
        total,
        sumAmount,
        page,
        limit,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get(
    "/api/account-movements/me/statement",
    sessionMiddleware,
    requireAuth,
    async (req, res, next) => {
      try {
        const parsed = parseStatementFromTo(req);
        if (!parsed) {
          return res.status(400).json({ message: "from and to must be YYYY-MM with from <= to" });
        }
        const societyId = getUserSocietyId(req.user!);
        const body = await buildAccountStatementJson(
          societyId,
          req.user!.id,
          parsed.from,
          parsed.to
        );
        if (!body) {
          return res.status(404).json({ message: "Member not found" });
        }
        res.json(body);
      } catch (e) {
        next(e);
      }
    }
  );

  app.get(
    "/api/account-movements/statement",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const parsed = parseStatementFromTo(req);
        if (!parsed) {
          return res.status(400).json({ message: "from and to must be YYYY-MM with from <= to" });
        }
        const userId = String(req.query.userId ?? "");
        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }
        const societyId = getUserSocietyId(req.user!);
        const body = await buildAccountStatementJson(societyId, userId, parsed.from, parsed.to);
        if (!body) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json(body);
      } catch (e) {
        next(e);
      }
    }
  );

  app.get(
    "/api/account-movements/society-statement",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const parsed = parseStatementFromTo(req);
        if (!parsed) {
          return res.status(400).json({ message: "from and to must be YYYY-MM with from <= to" });
        }
        const societyId = getUserSocietyId(req.user!);
        const body = await buildSocietyStatementJson(societyId, parsed.from, parsed.to);
        res.json(body);
      } catch (e) {
        next(e);
      }
    }
  );

  app.get(
    "/api/account-movements/balances",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const monthRaw = req.query.month as string | undefined;
        const asOfMonth =
          monthRaw && monthRaw.length > 0 ? (MONTH_YM.test(monthRaw) ? monthRaw : null) : null;
        if (monthRaw && monthRaw.length > 0 && asOfMonth === null) {
          return res.status(400).json({ message: "month must be YYYY-MM when provided" });
        }
        const { members, totalBalance } = await getAllMemberBalances(societyId, asOfMonth);
        res.json({
          asOfMonth,
          members,
          totalBalance,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/api/account-movements/refund",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_MANAGE),
    async (req, res, next) => {
      try {
        const parsed = accountMovementRefundBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid payload", issues: parsed.error.flatten() });
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

        const movement = await postLedgerRefund({
          societyId,
          userId,
          amount: amountNum,
          description,
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
    requirePermission(Permission.MOVEMENTS_MANAGE),
    async (req, res, next) => {
      try {
        const parsed = accountMovementSepaBounceBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid payload", issues: parsed.error.flatten() });
        }
        const societyId = getUserSocietyId(req.user!);
        const { creditId } = parsed.data;

        const [credit] = await db
          .select()
          .from(credits)
          .where(and(eq(credits.id, creditId), eq(credits.societyId, societyId)));
        if (!credit) return res.status(404).json({ message: "Credit not found" });
        if (credit.status !== "paid") {
          return res
            .status(400)
            .json({ message: "Only paid credits can be reverted for SEPA bounce" });
        }

        const refKey = credit.id;
        if (await bounceAlreadyRecorded(societyId, refKey)) {
          return res.status(400).json({ message: "Bounce already recorded for this credit" });
        }

        let movement;
        try {
          movement = await postSepaBounceAndResetCredit({
            societyId,
            credit,
            createdBy: req.user!.id,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Bounce already recorded")) {
            return res.status(400).json({ message: "Bounce already recorded for this credit" });
          }
          throw err;
        }

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
