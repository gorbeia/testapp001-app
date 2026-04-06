import type { Express, Request, Response, NextFunction } from "express";
import { type JwtSessionUser } from "@shared/schema";
import { sessionMiddleware, requireAuth } from "./middleware";
import { getMemberAccountBalance } from "../lib/account-movements";
import { getEffectivePrepaymentFloor } from "../lib/prepayment-ledger-floor";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
};

export function registerPrepaymentLedgerStatusRoutes(app: Express) {
  app.get(
    "/api/me/prepayment-ledger-status",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const societyId = getUserSocietyId(user);
        const floor = await getEffectivePrepaymentFloor(societyId);
        if (floor === null) {
          return res.json({
            enforced: false,
            floor: null,
            balance: await getMemberAccountBalance(societyId, user.id),
            belowFloor: false,
          });
        }
        const balance = await getMemberAccountBalance(societyId, user.id);
        const belowFloor = balance + 1e-6 < floor;
        return res.json({
          enforced: true,
          floor,
          balance,
          belowFloor,
        });
      } catch (e) {
        next(e);
      }
    }
  );
}
