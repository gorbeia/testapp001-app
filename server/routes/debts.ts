import type { Express } from "express";
import { db } from "../db";
import { batchCreditStatusBodySchema, credits, users } from "@shared/schema";
import { Permission } from "@shared/permissions";
import { appendSepaCollectionMovementsForCredits } from "../lib/ledger/ledger-service";
import { eq, and, sum, inArray, desc, sql, or, ilike } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { sessionMiddleware, requireAuth, requirePermission } from "./middleware";

const getUserSocietyId = (user: { societyId: string }): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

export function registerDebtRoutes(app: Express) {
  // Get current user's credits (authenticated users only)
  app.get("/api/credits/member/current", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      const { month, status } = req.query;
      const user = req.user!;
      const userId = user.id;
      const societyId = getUserSocietyId(user);

      const conditions = [eq(credits.memberId, userId), eq(credits.societyId, societyId)];

      if (month) {
        conditions.push(eq(credits.month, month as string));
      }

      if (status && status !== "all") {
        conditions.push(eq(credits.status, status as string));
      }

      const query = db
        .select()
        .from(credits)
        .where(and(...conditions));

      const userCredits = await query.orderBy(desc(credits.year), desc(credits.monthNumber));

      res.json(userCredits);
    } catch (error) {
      next(error);
    }
  });

  // Get all credits (treasurer only)
  app.get(
    "/api/credits",
    sessionMiddleware,
    requirePermission(Permission.CREDITS_VIEW),
    async (req, res, next) => {
      try {
        const { month, status, search: searchRaw } = req.query;
        const societyId = getUserSocietyId(req.user!);
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(
          100,
          Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25)
        );
        const offset = (page - 1) * limit;

        const conditions = [eq(credits.societyId, societyId)];

        if (month) {
          conditions.push(eq(credits.month, month as string));
        }

        if (status) {
          conditions.push(eq(credits.status, status as string));
        }

        if (searchRaw && String(searchRaw).trim()) {
          const raw = String(searchRaw).replace(/%/g, "\\%").trim();
          const term = `%${raw}%`;
          const members = await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.societyId, societyId),
                or(ilike(users.name, term), ilike(users.username, term))
              )
            );
          const mids = members.map(m => m.id);
          const parts = [ilike(credits.month, term), ilike(credits.status, term)];
          if (mids.length > 0) {
            parts.push(inArray(credits.memberId, mids));
          }
          const searchOr = or(...parts);
          if (searchOr) {
            conditions.push(searchOr);
          }
        }

        const whereClause = and(...conditions);

        const [totalRow] = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(credits)
          .where(whereClause);
        const total = totalRow?.c ?? 0;

        const [pendingSumRow] = await db
          .select({
            s: sql<string>`coalesce(sum(${credits.totalAmount}::numeric), 0)::text`,
          })
          .from(credits)
          .where(and(whereClause, eq(credits.status, "pending")));

        const [paidSumRow] = await db
          .select({
            s: sql<string>`coalesce(sum(${credits.totalAmount}::numeric), 0)::text`,
          })
          .from(credits)
          .where(and(whereClause, eq(credits.status, "paid")));

        const sumPending = parseFloat(String(pendingSumRow?.s ?? "0"));
        const sumPaid = parseFloat(String(paidSumRow?.s ?? "0"));

        const allCredits = await db
          .select()
          .from(credits)
          .where(whereClause)
          .orderBy(credits.year, credits.monthNumber, credits.memberId)
          .limit(limit)
          .offset(offset);

        // Get member names and payment tracking info
        const creditsWithNames = await Promise.all(
          allCredits.map(async credit => {
            const [member] = await db
              .select()
              .from(users)
              .where(and(eq(users.id, credit.memberId), eq(users.societyId, societyId)));
            let markedByUser = null;

            if (credit.markedAsPaidBy) {
              const [markedBy] = await db
                .select()
                .from(users)
                .where(and(eq(users.id, credit.markedAsPaidBy), eq(users.societyId, societyId)));
              markedByUser = markedBy?.name || null;
              if (!markedBy) {
                console.log(
                  `User not found for markedAsPaidBy: ${credit.markedAsPaidBy} for credit ${credit.id}`
                );
              }
            } else if (credit.status === "paid") {
              // Credit was marked as paid before tracking was implemented
              markedByUser = "Ezezaguna (aurreko sistema)";
            }

            return {
              ...credit,
              memberName: member?.name || "Unknown",
              markedByUser: markedByUser,
              markedByUserName: markedByUser,
            };
          })
        );

        res.json({
          data: creditsWithNames,
          total,
          sumPending,
          sumPaid,
          page,
          limit,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get credits sum by status (for dashboard stats)
  app.get(
    "/api/credits/sum",
    sessionMiddleware,
    requirePermission(Permission.CREDITS_VIEW),
    async (req, res, next) => {
      try {
        const { status } = req.query;
        const societyId = getUserSocietyId(req.user!);

        const conditions = [eq(credits.societyId, societyId)];

        if (status && ["pending", "paid", "partial"].includes(status as string)) {
          conditions.push(eq(credits.status, status as string));
        }

        const result = await db
          .select({
            sum: sum(credits.totalAmount),
          })
          .from(credits)
          .where(and(...conditions));

        const totalSum = result[0]?.sum || 0;

        res.json({ sum: parseFloat(totalSum.toString()) || 0 });
      } catch (error) {
        next(error);
      }
    }
  );

  // Batch update credit status
  app.put(
    "/api/credits/batch-status",
    sessionMiddleware,
    requirePermission(Permission.CREDITS_MANAGE),
    async (req, res, next) => {
      try {
        const parsedBody = batchCreditStatusBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json({
            message: "Invalid payload",
            issues: parsedBody.error.flatten(),
          });
        }

        const { creditIds, status } = parsedBody.data;
        const societyId = getUserSocietyId(req.user!);

        const uniqueCreditIds = Array.from(new Set(creditIds));

        // Get all credits to validate and check current month restriction
        const creditsToUpdate = await db
          .select()
          .from(credits)
          .where(and(inArray(credits.id, uniqueCreditIds), eq(credits.societyId, societyId)));

        if (creditsToUpdate.length === 0) {
          return res.status(404).json({ message: "No credits found" });
        }

        if (creditsToUpdate.length !== uniqueCreditIds.length) {
          return res.status(400).json({
            message: "Some credit IDs are missing or do not belong to your society",
          });
        }

        // Check if any are for current month (only when marking as paid)
        if (status === "paid") {
          const currentDate = new Date();
          const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;

          const currentMonthCredits = creditsToUpdate.filter(
            credit => credit.month === currentMonthString
          );
          if (currentMonthCredits.length > 0) {
            return res.status(400).json({
              message: "Ezin da uneko hilabetea itxi. Itxaron hilabetea amaitu arte.",
            });
          }
        }

        const updateData: PgUpdateSetSource<typeof credits> = {
          status,
          updatedAt: new Date(),
          ...(status === "paid"
            ? { markedAsPaidBy: req.user!.id, markedAsPaidAt: new Date() }
            : {}),
        };

        const updatedCredits = await db.transaction(async tx => {
          const rows = await tx
            .update(credits)
            .set(updateData)
            .where(and(inArray(credits.id, uniqueCreditIds), eq(credits.societyId, societyId)))
            .returning();

          if (status === "paid") {
            await appendSepaCollectionMovementsForCredits(tx, {
              societyId,
              credits: rows,
              createdBy: req.user!.id,
            });
          }

          return rows;
        });

        res.json({
          message: `Updated ${updatedCredits.length} credits`,
          updatedCredits,
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
