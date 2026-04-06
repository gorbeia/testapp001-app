import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  bankTransfers,
  bankTransferCreateBodySchema,
  bankTransferMemberProposalBodySchema,
  bankTransferRejectBodySchema,
  bankTransferStatusSchema,
  societies,
  societyAllowsBankTransferPrepayment,
  users,
  type JwtSessionUser,
} from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import { insertAccountMovementRow } from "../lib/account-movements";
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

const PREPAYMENT_PROPOSALS_DISABLED_MESSAGE =
  "Prepayment proposals are not enabled for this society";

async function prepaymentEnabledForSociety(societyId: string): Promise<boolean> {
  const [row] = await db
    .select({ paymentMethods: societies.paymentMethods })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  if (!row) return false;
  return societyAllowsBankTransferPrepayment(row.paymentMethods);
}

export function registerBankTransferRoutes(app: Express) {
  app.get("/api/bank-transfers/me", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      if (!(await prepaymentEnabledForSociety(societyId))) {
        return res
          .status(403)
          .json({ message: PREPAYMENT_PROPOSALS_DISABLED_MESSAGE });
      }
      const userId = req.user!.id;
      const statusRaw = req.query.status as string | undefined;

      const conditions = [eq(bankTransfers.societyId, societyId), eq(bankTransfers.userId, userId)];
      if (statusRaw && statusRaw !== "all") {
        const parsedStatus = bankTransferStatusSchema.safeParse(statusRaw);
        if (parsedStatus.success) {
          conditions.push(eq(bankTransfers.status, parsedStatus.data));
        }
      }

      const rows = await db
        .select()
        .from(bankTransfers)
        .where(and(...conditions))
        .orderBy(desc(bankTransfers.createdAt));

      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/bank-transfers/me", sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      const societyIdEarly = getUserSocietyId(req.user!);
      if (!(await prepaymentEnabledForSociety(societyIdEarly))) {
        return res
          .status(403)
          .json({ message: PREPAYMENT_PROPOSALS_DISABLED_MESSAGE });
      }
      const parsed = bankTransferMemberProposalBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
      }
      const societyId = getUserSocietyId(req.user!);
      const userId = req.user!.id;
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

      const td =
        parsed.data.transferDate instanceof Date
          ? parsed.data.transferDate.toISOString().slice(0, 10)
          : String(parsed.data.transferDate).slice(0, 10);

      const [row] = await db
        .insert(bankTransfers)
        .values({
          societyId,
          userId,
          amount: amountNum.toFixed(2),
          transferDate: td,
          reference: parsed.data.reference ?? null,
          notes: parsed.data.notes ?? null,
          status: "pending",
        })
        .returning();

      res.status(201).json(row);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/bank-transfers", sessionMiddleware, requireTreasurer, async (req, res, next) => {
    try {
      const societyIdEarly = getUserSocietyId(req.user!);
      if (!(await prepaymentEnabledForSociety(societyIdEarly))) {
        return res
          .status(403)
          .json({ message: PREPAYMENT_PROPOSALS_DISABLED_MESSAGE });
      }
      const parsed = bankTransferCreateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
      }
      const societyId = getUserSocietyId(req.user!);
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
        .where(and(eq(users.id, parsed.data.userId), eq(users.societyId, societyId)));
      if (!member) return res.status(404).json({ message: "User not found" });

      const td =
        parsed.data.transferDate instanceof Date
          ? parsed.data.transferDate.toISOString().slice(0, 10)
          : String(parsed.data.transferDate).slice(0, 10);

      const [row] = await db
        .insert(bankTransfers)
        .values({
          societyId,
          userId: parsed.data.userId,
          amount: amountNum.toFixed(2),
          transferDate: td,
          reference: parsed.data.reference ?? null,
          notes: parsed.data.notes ?? null,
          status: "pending",
        })
        .returning();

      res.status(201).json(row);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/bank-transfers", sessionMiddleware, requireTreasurer, async (req, res, next) => {
    try {
      const societyId = getUserSocietyId(req.user!);
      if (!(await prepaymentEnabledForSociety(societyId))) {
        return res
          .status(403)
          .json({ message: PREPAYMENT_PROPOSALS_DISABLED_MESSAGE });
      }
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;
      const month = req.query.month as string | undefined;

      const conditions = [eq(bankTransfers.societyId, societyId)];
      if (status && status !== "all") {
        conditions.push(eq(bankTransfers.status, status));
      }
      if (userId) conditions.push(eq(bankTransfers.userId, userId));
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        conditions.push(sql`to_char(${bankTransfers.transferDate}, 'YYYY-MM') = ${month}`);
      }

      const rows = await db
        .select()
        .from(bankTransfers)
        .where(and(...conditions))
        .orderBy(desc(bankTransfers.createdAt));

      const enriched = await Promise.all(
        rows.map(async r => {
          const [u] = await db
            .select({ name: users.name, username: users.username })
            .from(users)
            .where(and(eq(users.id, r.userId), eq(users.societyId, societyId)));
          return { ...r, memberName: u?.name ?? null, memberUsername: u?.username ?? null };
        })
      );

      res.json(enriched);
    } catch (e) {
      next(e);
    }
  });

  app.put(
    "/api/bank-transfers/:id/validate",
    sessionMiddleware,
    requireTreasurer,
    async (req, res, next) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        if (!(await prepaymentEnabledForSociety(societyId))) {
          return res
            .status(403)
            .json({ message: PREPAYMENT_PROPOSALS_DISABLED_MESSAGE });
        }
        const { id } = req.params;

        const [bt] = await db
          .select()
          .from(bankTransfers)
          .where(and(eq(bankTransfers.id, id), eq(bankTransfers.societyId, societyId)));
        if (!bt) return res.status(404).json({ message: "Prepayment record not found" });
        if (bt.status !== "pending") {
          return res.status(400).json({ message: "Prepayment proposal is not pending" });
        }

        const amountNum = parseFloat(String(bt.amount));
        const ledgerAmount = amountNum.toFixed(2);

        const movement = await insertAccountMovementRow({
          societyId,
          userId: bt.userId,
          type: "bank_transfer",
          amount: ledgerAmount,
          description: bt.reference ? `Prepayment: ${bt.reference}` : "Prepayment validated",
          referenceId: bt.id,
          referenceType: "bank_transfer",
          createdBy: req.user!.id,
        });

        const [updated] = await db
          .update(bankTransfers)
          .set({
            status: "validated",
            validatedBy: req.user!.id,
            validatedAt: new Date(),
            movementId: movement.id,
            updatedAt: new Date(),
          })
          .where(eq(bankTransfers.id, id))
          .returning();

        await notifyFinancialEvent({
          userId: bt.userId,
          societyId,
          referenceId: movement.id,
          titleKey: "financialBankTransferValidatedTitle",
          messageKey: "financialBankTransferValidatedMessage",
          params: { amount: amountNum.toFixed(2) },
        });

        res.json(updated);
      } catch (e) {
        next(e);
      }
    }
  );

  app.put(
    "/api/bank-transfers/:id/reject",
    sessionMiddleware,
    requireTreasurer,
    async (req, res, next) => {
      try {
        const parsed = bankTransferRejectBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Invalid payload", issues: parsed.error.flatten() });
        }
        const societyId = getUserSocietyId(req.user!);
        if (!(await prepaymentEnabledForSociety(societyId))) {
          return res
            .status(403)
            .json({ message: PREPAYMENT_PROPOSALS_DISABLED_MESSAGE });
        }
        const { id } = req.params;

        const [bt] = await db
          .select()
          .from(bankTransfers)
          .where(and(eq(bankTransfers.id, id), eq(bankTransfers.societyId, societyId)));
        if (!bt) return res.status(404).json({ message: "Prepayment record not found" });
        if (bt.status !== "pending") {
          return res.status(400).json({ message: "Prepayment proposal is not pending" });
        }

        const [updated] = await db
          .update(bankTransfers)
          .set({
            status: "rejected",
            validatedBy: req.user!.id,
            validatedAt: new Date(),
            rejectionReason: parsed.data.rejectionReason,
            updatedAt: new Date(),
          })
          .where(eq(bankTransfers.id, id))
          .returning();

        await notifyFinancialEvent({
          userId: bt.userId,
          societyId,
          referenceId: bt.id,
          titleKey: "financialBankTransferRejectedTitle",
          messageKey: "financialBankTransferRejectedMessage",
          params: { reason: parsed.data.rejectionReason },
        });

        res.json(updated);
      } catch (e) {
        next(e);
      }
    }
  );
}
