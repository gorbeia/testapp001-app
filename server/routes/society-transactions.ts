import type { Express } from "express";
import { db } from "../db";
import {
  societyLedger,
  societyTransactionCategoryTypeSchema,
  societyTransactionBodySchema,
  societyTransactionUpdateBodySchema,
} from "@shared/schema";
import {
  isSocietyCategoryKey,
  societyCategoryType,
  societyExpenseCategories,
  societyIncomeCategories,
  type SocietyCategoryKey,
} from "@shared/society-categories";
import { Permission } from "@shared/permissions";
import { and, count, eq, inArray, sql, desc } from "drizzle-orm";
import { sessionMiddleware, requirePermission } from "./middleware";
import { postManualEntry, editManualEntry, deleteManualEntry } from "../lib/society-ledger";

const getUserSocietyId = (user: { societyId: string }): string => {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
};

const MONTH_YM = /^\d{4}-\d{2}$/;

function formatAmountForDb(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid amount");
  return n.toFixed(2);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapLedgerManualToApiItem(row: {
  id: string;
  societyId: string;
  category: string | null;
  amount: string;
  description: string | null;
  bookingDate: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const cat = row.category && isSocietyCategoryKey(row.category) ? row.category : null;
  const categoryType = cat ? societyCategoryType(cat) : null;
  return {
    id: row.id,
    societyId: row.societyId,
    category: cat,
    categoryType,
    date: row.bookingDate,
    amount: formatAmountForDb(Math.abs(parseFloat(String(row.amount)))),
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerSocietyTransactionRoutes(app: Express): void {
  app.get(
    "/api/society-transactions",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const month = String(req.query.month ?? "");
        const fromM = String(req.query.from ?? "");
        const toM = String(req.query.to ?? "");
        const categoryFilter = req.query.category ? String(req.query.category) : null;
        const typeQ = req.query.type ? String(req.query.type) : null;
        const parsedType = typeQ
          ? societyTransactionCategoryTypeSchema.safeParse(typeQ)
          : { success: true as const, data: undefined as undefined };

        if (typeQ && !parsedType.success) {
          return res.status(400).json({ message: "Invalid type filter" });
        }

        if (categoryFilter && !isSocietyCategoryKey(categoryFilter)) {
          return res.status(400).json({ message: "Invalid category filter" });
        }

        const limit = Math.min(
          200,
          Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50)
        );
        const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

        const baseManual = and(
          eq(societyLedger.societyId, societyId),
          eq(societyLedger.voided, false),
          sql`${societyLedger.type} IN ('manual_income', 'manual_expense')`
        );

        const conditions = [baseManual];

        if (month && MONTH_YM.test(month)) {
          conditions.push(sql`to_char(${societyLedger.bookingDate}, 'YYYY-MM') = ${month}`);
        } else if (MONTH_YM.test(fromM) && MONTH_YM.test(toM) && fromM <= toM) {
          conditions.push(sql`to_char(${societyLedger.bookingDate}, 'YYYY-MM') >= ${fromM}`);
          conditions.push(sql`to_char(${societyLedger.bookingDate}, 'YYYY-MM') <= ${toM}`);
        }
        if (categoryFilter) {
          conditions.push(eq(societyLedger.category, categoryFilter));
        }
        if (parsedType.success && parsedType.data) {
          const keysOfType =
            parsedType.data === "income" ? societyIncomeCategories() : societyExpenseCategories();
          conditions.push(inArray(societyLedger.category, keysOfType));
        }

        const [{ total }] = await db
          .select({ total: count() })
          .from(societyLedger)
          .where(and(...conditions));

        const rows = await db
          .select({
            id: societyLedger.id,
            societyId: societyLedger.societyId,
            category: societyLedger.category,
            amount: societyLedger.amount,
            description: societyLedger.description,
            bookingDate: societyLedger.bookingDate,
            createdBy: societyLedger.createdBy,
            createdAt: societyLedger.createdAt,
            updatedAt: societyLedger.updatedAt,
          })
          .from(societyLedger)
          .where(and(...conditions))
          .orderBy(desc(societyLedger.bookingDate), desc(societyLedger.id))
          .limit(limit)
          .offset(offset);

        return res.json({
          items: rows.map(mapLedgerManualToApiItem),
          total: Number(total),
          limit,
          offset,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/society-transactions",
    sessionMiddleware,
    requirePermission(Permission.SOCIETY_TRANSACTIONS_MANAGE),
    async (req, res, next) => {
      try {
        const parsed = societyTransactionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid body",
            issues: parsed.error.flatten(),
          });
        }
        const societyId = getUserSocietyId(req.user!);
        const { category, date, amount, description } = parsed.data;

        let amtNum: number;
        try {
          amtNum = parseFloat(formatAmountForDb(amount));
        } catch {
          return res.status(400).json({ message: "Invalid amount" });
        }

        const booking =
          typeof date === "string"
            ? toYmd(new Date(date + "T12:00:00"))
            : toYmd(date instanceof Date ? date : new Date(date));

        const created = await db.transaction(async tx => {
          return postManualEntry(tx, {
            societyId,
            category: category as SocietyCategoryKey,
            amount: amtNum,
            description: description ?? null,
            bookingDate: booking,
            createdBy: req.user!.id,
          });
        });

        const [row] = await db
          .select({
            id: societyLedger.id,
            societyId: societyLedger.societyId,
            category: societyLedger.category,
            amount: societyLedger.amount,
            description: societyLedger.description,
            bookingDate: societyLedger.bookingDate,
            createdBy: societyLedger.createdBy,
            createdAt: societyLedger.createdAt,
            updatedAt: societyLedger.updatedAt,
          })
          .from(societyLedger)
          .where(eq(societyLedger.id, created.id));

        return res.status(201).json(mapLedgerManualToApiItem(row!));
      } catch (err) {
        next(err);
      }
    }
  );

  app.put(
    "/api/society-transactions/:id",
    sessionMiddleware,
    requirePermission(Permission.SOCIETY_TRANSACTIONS_MANAGE),
    async (req, res, next) => {
      try {
        const id = String(req.params.id);
        const societyId = getUserSocietyId(req.user!);

        const parsed = societyTransactionUpdateBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid body",
            issues: parsed.error.flatten(),
          });
        }

        const [existing] = await db
          .select()
          .from(societyLedger)
          .where(
            and(
              eq(societyLedger.id, id),
              eq(societyLedger.societyId, societyId),
              eq(societyLedger.voided, false),
              sql`${societyLedger.type} IN ('manual_income', 'manual_expense')`
            )
          );

        if (!existing) {
          return res.status(404).json({ message: "Not found" });
        }

        let category = (
          existing.category && isSocietyCategoryKey(existing.category)
            ? existing.category
            : "other_expense"
        ) as SocietyCategoryKey;
        if (parsed.data.category !== undefined) {
          category = parsed.data.category as SocietyCategoryKey;
        }

        let amountNum = Math.abs(parseFloat(String(existing.amount))) || 0;
        if (parsed.data.amount !== undefined) {
          try {
            amountNum = parseFloat(formatAmountForDb(parsed.data.amount));
          } catch {
            return res.status(400).json({ message: "Invalid amount" });
          }
        }

        const bookingDate =
          parsed.data.date !== undefined
            ? typeof parsed.data.date === "string"
              ? toYmd(new Date(parsed.data.date + "T12:00:00"))
              : toYmd(parsed.data.date)
            : existing.bookingDate;

        const description =
          parsed.data.description !== undefined ? parsed.data.description : existing.description;

        const result = await db.transaction(async tx =>
          editManualEntry(tx, {
            societyId,
            entryId: id,
            category,
            amount: amountNum,
            description: description ?? null,
            bookingDate,
            createdBy: req.user!.id,
          })
        );

        if ("error" in result && result.error === "not_found") {
          return res.status(404).json({ message: "Not found" });
        }

        const [row] = await db
          .select({
            id: societyLedger.id,
            societyId: societyLedger.societyId,
            category: societyLedger.category,
            amount: societyLedger.amount,
            description: societyLedger.description,
            bookingDate: societyLedger.bookingDate,
            createdBy: societyLedger.createdBy,
            createdAt: societyLedger.createdAt,
            updatedAt: societyLedger.updatedAt,
          })
          .from(societyLedger)
          .where(eq(societyLedger.id, id));

        return res.json(mapLedgerManualToApiItem(row!));
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    "/api/society-transactions/:id",
    sessionMiddleware,
    requirePermission(Permission.SOCIETY_TRANSACTIONS_MANAGE),
    async (req, res, next) => {
      try {
        const id = String(req.params.id);
        const societyId = getUserSocietyId(req.user!);

        const result = await db.transaction(async tx =>
          deleteManualEntry(tx, {
            societyId,
            entryId: id,
            createdBy: req.user!.id,
          })
        );

        if ("error" in result && result.error === "not_found") {
          return res.status(404).json({ message: "Not found" });
        }

        return res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );
}
