import type { Express } from "express";
import { db, pool } from "../db";
import { societyAccountingSummaryQuerySchema, societyLedger } from "@shared/schema";
import {
  isSocietyCategoryKey,
  societyCategoryType,
  societyExpenseCategories,
  societyIncomeCategories,
} from "@shared/society-categories";
import { Permission } from "@shared/permissions";
import { and, eq, inArray, sql } from "drizzle-orm";
import { sessionMiddleware, requirePermission } from "./middleware";
import { SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT } from "../lib/society-ledger";

const getUserSocietyId = (user: { societyId: string }): string => {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
};

const INCOME_TYPES = ["prepayment", "sepa_collection", "cash_payment"] as const;
const DERIVED_EXPENSE_TYPES = ["refund", "sepa_bounce"] as const;

const DERIVED_INCOME_LABEL_KEYS: Record<(typeof INCOME_TYPES)[number], string> = {
  prepayment: "memberPrepayments",
  sepa_collection: "sepaCollections",
  cash_payment: "cashPayments",
};

type SummaryRow = { type: string; labelKey: string; total: number };

function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Map society_ledger type to member movement type for client labels */
function displayMovementType(ledgerType: string): string {
  if (ledgerType === "prepayment") return "bank_transfer";
  return ledgerType;
}

export function registerSocietyAccountingRoutes(app: Express): void {
  app.get(
    "/api/society-accounting/summary",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const parsed = societyAccountingSummaryQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid query",
            issues: parsed.error.flatten(),
          });
        }
        const { from, to } = parsed.data;
        if (from > to) {
          return res.status(400).json({ message: "from must be <= to" });
        }

        const societyId = getUserSocietyId(req.user!);
        const monthFilter = sql`to_char(${societyLedger.bookingDate}, 'YYYY-MM') >= ${from} AND to_char(${societyLedger.bookingDate}, 'YYYY-MM') <= ${to}`;

        const baseWhere = and(
          eq(societyLedger.societyId, societyId),
          monthFilter,
          eq(societyLedger.voided, false)
        );

        const incomeRows = await db
          .select({
            type: societyLedger.type,
            total: sql<string>`coalesce(sum(${societyLedger.amount}::numeric), 0)`.as("total"),
          })
          .from(societyLedger)
          .where(and(baseWhere, inArray(societyLedger.type, [...INCOME_TYPES])))
          .groupBy(societyLedger.type);

        const derivedIncomeByType: SummaryRow[] = [];
        for (const t of INCOME_TYPES) {
          const row = incomeRows.find(r => r.type === t);
          const total = num(row?.total);
          if (total > 0) {
            derivedIncomeByType.push({
              type: t,
              labelKey: DERIVED_INCOME_LABEL_KEYS[t],
              total,
            });
          }
        }

        const expenseRows = await db
          .select({
            type: societyLedger.type,
            total: sql<string>`coalesce(sum(-(${societyLedger.amount}::numeric)), 0)`.as("total"),
          })
          .from(societyLedger)
          .where(and(baseWhere, inArray(societyLedger.type, [...DERIVED_EXPENSE_TYPES])))
          .groupBy(societyLedger.type);

        const derivedExpensesByType: SummaryRow[] = [];
        for (const typ of DERIVED_EXPENSE_TYPES) {
          const row = expenseRows.find(r => r.type === typ);
          const total = num(row?.total);
          if (total > 0) {
            derivedExpensesByType.push({
              type: typ,
              labelKey: typ === "refund" ? "refundsLabel" : "sepaBounces",
              total,
            });
          }
        }

        const incomeCatKeys = societyIncomeCategories();
        const expenseCatKeys = societyExpenseCategories();

        const manualIncomeRows = await db
          .select({
            category: societyLedger.category,
            total: sql<string>`coalesce(sum(${societyLedger.amount}::numeric), 0)`.as("total"),
          })
          .from(societyLedger)
          .where(
            and(
              baseWhere,
              eq(societyLedger.type, "manual_income"),
              inArray(societyLedger.category, incomeCatKeys)
            )
          )
          .groupBy(societyLedger.category);

        const manualExpenseRows = await db
          .select({
            category: societyLedger.category,
            total: sql<string>`coalesce(sum(-(${societyLedger.amount}::numeric)), 0)`.as("total"),
          })
          .from(societyLedger)
          .where(
            and(
              baseWhere,
              eq(societyLedger.type, "manual_expense"),
              inArray(societyLedger.category, expenseCatKeys)
            )
          )
          .groupBy(societyLedger.category);

        const adjPos = await db
          .select({
            t: sql<string>`coalesce(sum(case when ${societyLedger.amount}::numeric > 0 then ${societyLedger.amount}::numeric else 0 end), 0)`,
          })
          .from(societyLedger)
          .where(and(baseWhere, eq(societyLedger.type, "manual_adjustment")));

        const adjNeg = await db
          .select({
            t: sql<string>`coalesce(sum(case when ${societyLedger.amount}::numeric < 0 then -(${societyLedger.amount}::numeric) else 0 end), 0)`,
          })
          .from(societyLedger)
          .where(and(baseWhere, eq(societyLedger.type, "manual_adjustment")));

        const adjustmentIncome = num(adjPos[0]?.t);
        const adjustmentExpense = num(adjNeg[0]?.t);

        const manualIncomeByCategory = manualIncomeRows
          .map(r => ({
            category: r.category!,
            total: num(r.total),
          }))
          .filter(r => r.category && isSocietyCategoryKey(r.category) && r.total > 0);
        const manualExpensesByCategory = manualExpenseRows
          .map(r => ({
            category: r.category!,
            total: num(r.total),
          }))
          .filter(r => r.category && isSocietyCategoryKey(r.category) && r.total > 0);

        const derivedIncomeTotal = derivedIncomeByType.reduce((s, r) => s + r.total, 0);
        const derivedExpensesTotal = derivedExpensesByType.reduce((s, r) => s + r.total, 0);
        const manualIncomeTotal = manualIncomeByCategory.reduce((s, r) => s + r.total, 0);
        const manualExpensesTotal = manualExpensesByCategory.reduce((s, r) => s + r.total, 0);

        const grandTotalIncome = derivedIncomeTotal + manualIncomeTotal + adjustmentIncome;
        const grandTotalExpenses = derivedExpensesTotal + manualExpensesTotal + adjustmentExpense;
        const net = grandTotalIncome - grandTotalExpenses;

        return res.json({
          derivedIncome: { byType: derivedIncomeByType, total: derivedIncomeTotal },
          derivedExpenses: { byType: derivedExpensesByType, total: derivedExpensesTotal },
          manualIncome: { byCategory: manualIncomeByCategory, total: manualIncomeTotal },
          manualExpenses: { byCategory: manualExpensesByCategory, total: manualExpensesTotal },
          adjustmentIncome,
          adjustmentExpense,
          grandTotalIncome,
          grandTotalExpenses,
          net,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    "/api/society-accounting/derived-movements",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const parsed = societyAccountingSummaryQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid query",
            issues: parsed.error.flatten(),
          });
        }
        const { from, to } = parsed.data;
        if (from > to) {
          return res.status(400).json({ message: "from must be <= to" });
        }

        const societyId = getUserSocietyId(req.user!);
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(
          100,
          Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25)
        );
        const offset = (page - 1) * limit;

        const baseParams = [societyId, from, to, SOCIETY_LEDGER_REF_ACCOUNT_MOVEMENT] as const;

        const derivedCte = `
          WITH lines AS (
            SELECT
              sl.id,
              sl.society_id,
              sl.type AS sl_type,
              sl.amount,
              sl.description,
              sl.booking_date,
              sl.created_at,
              sl.is_manual,
              sl.category,
              m.user_id,
              u.name AS member_name,
              u.username AS member_username
            FROM society_ledger sl
            LEFT JOIN account_movements m
              ON sl.reference_type = $4 AND sl.reference_id = m.id AND m.society_id = sl.society_id
            LEFT JOIN users u
              ON m.user_id = u.id AND u.society_id = sl.society_id
            WHERE sl.society_id = $1
              AND sl.voided = false
              AND to_char(sl.booking_date, 'YYYY-MM') >= $2
              AND to_char(sl.booking_date, 'YYYY-MM') <= $3
          ),
          ordered AS (
            SELECT *,
              SUM(amount::numeric) OVER (
                ORDER BY booking_date ASC, created_at ASC, id ASC
              ) AS society_balance
            FROM lines
          )`;

        type PgRow = {
          id: string;
          society_id: string;
          sl_type: string;
          amount: string;
          description: string | null;
          booking_date: Date;
          created_at: Date;
          is_manual: boolean;
          category: string | null;
          user_id: string | null;
          member_name: string | null;
          member_username: string | null;
          society_balance: string;
        };

        const countSql = `${derivedCte} SELECT COUNT(*)::int AS c FROM ordered`;
        const countRes = await pool.query<{ c: number }>(countSql, [...baseParams]);
        const total = countRes.rows[0]?.c ?? 0;

        const dataSql = `${derivedCte}
          SELECT * FROM ordered
          ORDER BY booking_date DESC, created_at DESC, id DESC
          LIMIT $5 OFFSET $6`;
        const dataRes = await pool.query<PgRow>(dataSql, [...baseParams, limit, offset]);

        return res.json({
          movements: (dataRes.rows as PgRow[]).map(m => {
            const isManual = m.is_manual;
            const isAdjustment = m.sl_type === "manual_adjustment";
            const source =
              isManual && !isAdjustment
                ? ("manual" as const)
                : isAdjustment
                  ? ("adjustment" as const)
                  : ("ledger" as const);
            const cat = m.category && isSocietyCategoryKey(m.category) ? m.category : null;
            const categoryType = cat ? societyCategoryType(cat) : null;
            return {
              source,
              id: m.id,
              userId: m.user_id,
              type: isManual
                ? isAdjustment
                  ? "manual_adjustment"
                  : "society_manual"
                : displayMovementType(m.sl_type),
              category: cat,
              categoryType,
              amount: formatDisplayAmount(m.amount, m.sl_type),
              description: m.description,
              createdAt: m.created_at.toISOString(),
              bookingDate: m.booking_date ? bookingDateIso(m.booking_date) : null,
              memberName: m.member_name,
              memberUsername: m.member_username,
              societyBalance: parseFloat(String(m.society_balance)),
            };
          }),
          total,
          page,
          limit,
        });
      } catch (err) {
        next(err);
      }
    }
  );
}

function bookingDateIso(d: Date): string {
  if (d instanceof Date) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  return String(d).slice(0, 10);
}

/** Positive display magnitude for expense manual / derived expense lines in UI */
function formatDisplayAmount(amount: string, slType: string): string {
  const n = parseFloat(String(amount));
  if (
    slType === "manual_adjustment" ||
    slType === "manual_expense" ||
    slType === "refund" ||
    slType === "sepa_bounce"
  ) {
    return Math.abs(n).toFixed(2);
  }
  return n.toFixed(2);
}
