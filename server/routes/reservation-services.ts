import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  reservationServices,
  societies,
  createReservationServiceBodySchema,
  updateReservationServiceBodySchema,
  reservationServicePriceToDecimalString,
  isBuiltinReservationServiceSlug,
  RESERVATION_SERVICE_SLUG_KITCHEN,
  reservationServiceLabelSourceForSlug,
  type JwtSessionUser,
} from "@shared/schema";
import { and, asc, eq } from "drizzle-orm";
import { sessionMiddleware, requireAuth, requirePermission } from "./middleware";
import { Permission } from "@shared/permissions";
import {
  ensureDefaultReservationServicesForSociety,
  syncSocietyKitchenPriceFromKitchenService,
} from "../lib/reservation-services-defaults";
import { allocateUniqueReservationServiceSlug } from "../lib/reservation-service-slug";

const getUserSocietyId = (user: JwtSessionUser): string => {
  if (!user.societyId) {
    throw new Error("User societyId not found in JWT");
  }
  return user.societyId;
};

function isBuiltinSlug(slug: string): boolean {
  return isBuiltinReservationServiceSlug(slug);
}

/** Same bootstrap as reservation POST: ensures kitchen/cleaning/heating rows exist (idempotent). */
async function bootstrapReservationServicesIfNeeded(societyId: string): Promise<void> {
  const [soc] = await db
    .select({ kitchenPricePerMember: societies.kitchenPricePerMember })
    .from(societies)
    .where(eq(societies.id, societyId))
    .limit(1);
  await ensureDefaultReservationServicesForSociety(
    db,
    societyId,
    soc?.kitchenPricePerMember ?? null
  );
}

export function registerReservationServiceRoutes(app: Express): void {
  app.get(
    "/api/reservation-services",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        await bootstrapReservationServicesIfNeeded(societyId);
        const rows = await db
          .select()
          .from(reservationServices)
          .where(
            and(eq(reservationServices.societyId, societyId), eq(reservationServices.isActive, true))
          )
          .orderBy(asc(reservationServices.sortOrder), asc(reservationServices.slug));
        res.json(rows);
      } catch (e) {
        next(e);
      }
    }
  );

  app.get(
    "/api/reservation-services/all",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.SOCIETY_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        await bootstrapReservationServicesIfNeeded(societyId);
        const rows = await db
          .select()
          .from(reservationServices)
          .where(eq(reservationServices.societyId, societyId))
          .orderBy(asc(reservationServices.sortOrder), asc(reservationServices.slug));
        res.json(rows);
      } catch (e) {
        next(e);
      }
    }
  );

  /** Idempotent: ensures built-in rows exist, then returns the full list (admin settings UI). */
  app.post(
    "/api/reservation-services/sync-built-ins",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.SOCIETY_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        await bootstrapReservationServicesIfNeeded(societyId);
        const rows = await db
          .select()
          .from(reservationServices)
          .where(eq(reservationServices.societyId, societyId))
          .orderBy(asc(reservationServices.sortOrder), asc(reservationServices.slug));
        res.json(rows);
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/api/reservation-services",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.SOCIETY_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const parsed = createReservationServiceBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid reservation service payload",
            issues: parsed.error.flatten(),
          });
        }

        const labelEu = parsed.data.labelEu.trim();
        const labelEs = parsed.data.labelEs.trim();
        const slug = await allocateUniqueReservationServiceSlug(
          societyId,
          reservationServiceLabelSourceForSlug(labelEu, labelEs)
        );

        const fixed = reservationServicePriceToDecimalString(parsed.data.fixedPrice ?? "0");
        const perMember = reservationServicePriceToDecimalString(parsed.data.pricePerMember ?? "0");

        const [created] = await db
          .insert(reservationServices)
          .values({
            societyId,
            slug,
            labelEu,
            labelEs,
            fixedPrice: fixed,
            pricePerMember: perMember,
            isActive: parsed.data.isActive ?? true,
            isDefault: parsed.data.isDefault ?? false,
            sortOrder: parsed.data.sortOrder ?? 10,
            updatedAt: new Date(),
          })
          .returning();

        res.status(201).json(created);
      } catch (e) {
        next(e);
      }
    }
  );

  app.put(
    "/api/reservation-services/:id",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.SOCIETY_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const { id } = req.params;
        const parsed = updateReservationServiceBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid reservation service payload",
            issues: parsed.error.flatten(),
          });
        }

        const [existing] = await db
          .select()
          .from(reservationServices)
          .where(and(eq(reservationServices.id, id), eq(reservationServices.societyId, societyId)))
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Reservation service not found" });
        }

        const mergedEu =
          parsed.data.labelEu !== undefined ? parsed.data.labelEu.trim() : existing.labelEu.trim();
        const mergedEs =
          parsed.data.labelEs !== undefined ? parsed.data.labelEs.trim() : existing.labelEs.trim();

        if (parsed.data.labelEu !== undefined || parsed.data.labelEs !== undefined) {
          if (!mergedEu && !mergedEs) {
            return res.status(400).json({
              message: "At least one of labelEu or labelEs must be non-empty",
            });
          }
        }

        const prevSource = reservationServiceLabelSourceForSlug(existing.labelEu, existing.labelEs);
        const nextSource = reservationServiceLabelSourceForSlug(mergedEu, mergedEs);

        let nextSlug = existing.slug;
        if (!isBuiltinSlug(existing.slug) && nextSource !== prevSource) {
          nextSlug = await allocateUniqueReservationServiceSlug(
            societyId,
            nextSource,
            existing.id
          );
        }

        const [updated] = await db
          .update(reservationServices)
          .set({
            ...(!isBuiltinSlug(existing.slug) && nextSlug !== existing.slug ? { slug: nextSlug } : {}),
            ...(parsed.data.labelEu !== undefined ? { labelEu: mergedEu } : {}),
            ...(parsed.data.labelEs !== undefined ? { labelEs: mergedEs } : {}),
            ...(parsed.data.fixedPrice !== undefined
              ? { fixedPrice: reservationServicePriceToDecimalString(parsed.data.fixedPrice) }
              : {}),
            ...(parsed.data.pricePerMember !== undefined
              ? { pricePerMember: reservationServicePriceToDecimalString(parsed.data.pricePerMember) }
              : {}),
            ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
            ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
            ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(reservationServices.id, id), eq(reservationServices.societyId, societyId)))
          .returning();

        if (updated?.slug === RESERVATION_SERVICE_SLUG_KITCHEN) {
          await syncSocietyKitchenPriceFromKitchenService(societyId);
        }

        res.json(updated);
      } catch (e) {
        next(e);
      }
    }
  );

  app.delete(
    "/api/reservation-services/:id",
    sessionMiddleware,
    requireAuth,
    requirePermission(Permission.SOCIETY_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const { id } = req.params;

        const [existing] = await db
          .select()
          .from(reservationServices)
          .where(and(eq(reservationServices.id, id), eq(reservationServices.societyId, societyId)))
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Reservation service not found" });
        }

        if (isBuiltinSlug(existing.slug)) {
          return res.status(400).json({
            message: "Built-in services cannot be deleted; disable them instead",
          });
        }

        await db
          .delete(reservationServices)
          .where(and(eq(reservationServices.id, id), eq(reservationServices.societyId, societyId)));

        res.status(204).send();
      } catch (e) {
        next(e);
      }
    }
  );
}
