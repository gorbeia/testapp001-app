import type { Express } from "express";
import { db } from "../db";
import {
  societyLedger,
  societyTransactionCategories,
  societyTransactionCategoryTypeSchema,
  societyTransactionBodySchema,
  societyTransactionUpdateBodySchema,
  societyTransactionCategoryBodySchema,
} from "@shared/schema";
import { Permission } from "@shared/permissions";
import { and, count, eq, sql, desc } from "drizzle-orm";
import { sessionMiddleware, requirePermission } from "./middleware";
import { ensureDefaultSocietyTransactionCategories } from "../lib/society-transaction-defaults";
import {
  postManualEntry,
  editManualEntry,
  deleteManualEntry,
  countManualEntriesForCategory,
} from "../lib/society-ledger";

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
  categoryId: string | null;
  amount: string;
  description: string | null;
  bookingDate: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  categoryName: string;
  categoryType: string;
}) {
  return {
    id: row.id,
    societyId: row.societyId,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryType: row.categoryType,
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
    "/api/society-transaction-categories",
    sessionMiddleware,
    requirePermission(Permission.MOVEMENTS_VIEW),
    async (req, res, next) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        await ensureDefaultSocietyTransactionCategories(societyId);

        const rows = await db
          .select()
          .from(societyTransactionCategories)
          .where(
            and(
              eq(societyTransactionCategories.societyId, societyId),
              eq(societyTransactionCategories.isActive, true)
            )
          )
          .orderBy(
            societyTransactionCategories.type,
            societyTransactionCategories.sortOrder,
            societyTransactionCategories.name
          );

        return res.json(rows);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/society-transaction-categories",
    sessionMiddleware,
    requirePermission(Permission.SOCIETY_TRANSACTIONS_MANAGE),
    async (req, res, next) => {
      try {
        const parsed = societyTransactionCategoryBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid body",
            issues: parsed.error.flatten(),
          });
        }
        const societyId = getUserSocietyId(req.user!);
        const { name, nameEs, type, sortOrder } = parsed.data;

        const [created] = await db
          .insert(societyTransactionCategories)
          .values({
            societyId,
            name,
            nameEs: nameEs ?? null,
            type,
            sortOrder: sortOrder ?? 100,
          })
          .returning();

        return res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  app.put(
    "/api/society-transaction-categories/:id",
    sessionMiddleware,
    requirePermission(Permission.SOCIETY_TRANSACTIONS_MANAGE),
    async (req, res, next) => {
      try {
        const id = String(req.params.id);
        const societyId = getUserSocietyId(req.user!);

        const parsed = societyTransactionCategoryBodySchema.partial().safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid body",
            issues: parsed.error.flatten(),
          });
        }

        const [existing] = await db
          .select()
          .from(societyTransactionCategories)
          .where(
            and(
              eq(societyTransactionCategories.id, id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          );

        if (!existing) {
          return res.status(404).json({ message: "Category not found" });
        }

        if (
          parsed.data.name === undefined &&
          parsed.data.nameEs === undefined &&
          parsed.data.sortOrder === undefined &&
          parsed.data.type === undefined
        ) {
          return res.status(400).json({ message: "No fields to update" });
        }

        let nextType: string | undefined;
        if (parsed.data.type !== undefined) {
          const t = societyTransactionCategoryTypeSchema.safeParse(parsed.data.type);
          if (!t.success) {
            return res.status(400).json({ message: "Invalid type" });
          }
          if (t.data !== existing.type) {
            const n = await countManualEntriesForCategory(id, societyId);
            if (n > 0) {
              return res.status(400).json({
                message: "Cannot change category type while transactions exist",
              });
            }
          }
          nextType = t.data;
        }

        const [updated] = await db
          .update(societyTransactionCategories)
          .set({
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.nameEs !== undefined ? { nameEs: parsed.data.nameEs ?? null } : {}),
            ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
            ...(nextType !== undefined ? { type: nextType } : {}),
          })
          .where(
            and(
              eq(societyTransactionCategories.id, id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          )
          .returning();

        return res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    "/api/society-transaction-categories/:id",
    sessionMiddleware,
    requirePermission(Permission.SOCIETY_TRANSACTIONS_MANAGE),
    async (req, res, next) => {
      try {
        const id = String(req.params.id);
        const societyId = getUserSocietyId(req.user!);

        const [existing] = await db
          .select()
          .from(societyTransactionCategories)
          .where(
            and(
              eq(societyTransactionCategories.id, id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          );

        if (!existing) {
          return res.status(404).json({ message: "Category not found" });
        }

        const n = await countManualEntriesForCategory(id, societyId);
        if (n > 0) {
          return res.status(400).json({
            message: "Category has transactions; deactivate instead",
          });
        }

        await db
          .update(societyTransactionCategories)
          .set({ isActive: false })
          .where(
            and(
              eq(societyTransactionCategories.id, id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          );

        return res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

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
        const categoryId = req.query.categoryId ? String(req.query.categoryId) : null;
        const typeQ = req.query.type ? String(req.query.type) : null;
        const parsedType = typeQ
          ? societyTransactionCategoryTypeSchema.safeParse(typeQ)
          : { success: true as const, data: undefined as undefined };

        if (typeQ && !parsedType.success) {
          return res.status(400).json({ message: "Invalid type filter" });
        }

        const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
        const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

        const categoryJoin = and(
          eq(societyLedger.categoryId, societyTransactionCategories.id),
          eq(societyTransactionCategories.societyId, societyId)
        );

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
        if (categoryId) {
          conditions.push(eq(societyLedger.categoryId, categoryId));
        }
        if (parsedType.success && parsedType.data) {
          conditions.push(eq(societyTransactionCategories.type, parsedType.data));
        }

        const [{ total }] = await db
          .select({ total: count() })
          .from(societyLedger)
          .innerJoin(societyTransactionCategories, categoryJoin)
          .where(and(...conditions));

        const rows = await db
          .select({
            id: societyLedger.id,
            societyId: societyLedger.societyId,
            categoryId: societyLedger.categoryId,
            categoryName: societyTransactionCategories.name,
            categoryType: societyTransactionCategories.type,
            amount: societyLedger.amount,
            description: societyLedger.description,
            bookingDate: societyLedger.bookingDate,
            createdBy: societyLedger.createdBy,
            createdAt: societyLedger.createdAt,
            updatedAt: societyLedger.updatedAt,
          })
          .from(societyLedger)
          .innerJoin(societyTransactionCategories, categoryJoin)
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
        const { categoryId, date, amount, description } = parsed.data;

        const [cat] = await db
          .select()
          .from(societyTransactionCategories)
          .where(
            and(
              eq(societyTransactionCategories.id, categoryId),
              eq(societyTransactionCategories.societyId, societyId),
              eq(societyTransactionCategories.isActive, true)
            )
          );

        if (!cat) {
          return res.status(400).json({ message: "Invalid category" });
        }

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
            categoryId,
            categoryType: cat.type as "income" | "expense",
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
            categoryId: societyLedger.categoryId,
            categoryName: societyTransactionCategories.name,
            categoryType: societyTransactionCategories.type,
            amount: societyLedger.amount,
            description: societyLedger.description,
            bookingDate: societyLedger.bookingDate,
            createdBy: societyLedger.createdBy,
            createdAt: societyLedger.createdAt,
            updatedAt: societyLedger.updatedAt,
          })
          .from(societyLedger)
          .innerJoin(
            societyTransactionCategories,
            and(
              eq(societyLedger.categoryId, societyTransactionCategories.id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          )
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

        const [existingJoin] = await db
          .select({
            entry: societyLedger,
            catType: societyTransactionCategories.type,
          })
          .from(societyLedger)
          .innerJoin(
            societyTransactionCategories,
            and(
              eq(societyLedger.categoryId, societyTransactionCategories.id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          )
          .where(
            and(
              eq(societyLedger.id, id),
              eq(societyLedger.societyId, societyId),
              eq(societyLedger.voided, false),
              sql`${societyLedger.type} IN ('manual_income', 'manual_expense')`
            )
          );

        if (!existingJoin) {
          return res.status(404).json({ message: "Not found" });
        }

        let categoryId = existingJoin.entry.categoryId!;
        let categoryType = existingJoin.catType as "income" | "expense";
        if (parsed.data.categoryId !== undefined) {
          const [c] = await db
            .select()
            .from(societyTransactionCategories)
            .where(
              and(
                eq(societyTransactionCategories.id, parsed.data.categoryId),
                eq(societyTransactionCategories.societyId, societyId),
                eq(societyTransactionCategories.isActive, true)
              )
            );
          if (!c) {
            return res.status(400).json({ message: "Invalid category" });
          }
          categoryId = parsed.data.categoryId;
          categoryType = c.type as "income" | "expense";
        }

        let amountNum =
          Math.abs(parseFloat(String(existingJoin.entry.amount))) || 0;
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
            : existingJoin.entry.bookingDate;

        const description =
          parsed.data.description !== undefined
            ? parsed.data.description
            : existingJoin.entry.description;

        const result = await db.transaction(async tx =>
          editManualEntry(tx, {
            societyId,
            entryId: id,
            categoryId,
            categoryType,
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
            categoryId: societyLedger.categoryId,
            categoryName: societyTransactionCategories.name,
            categoryType: societyTransactionCategories.type,
            amount: societyLedger.amount,
            description: societyLedger.description,
            bookingDate: societyLedger.bookingDate,
            createdBy: societyLedger.createdBy,
            createdAt: societyLedger.createdAt,
            updatedAt: societyLedger.updatedAt,
          })
          .from(societyLedger)
          .innerJoin(
            societyTransactionCategories,
            and(
              eq(societyLedger.categoryId, societyTransactionCategories.id),
              eq(societyTransactionCategories.societyId, societyId)
            )
          )
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
