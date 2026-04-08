import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  imageUploadEntitySchema,
  societies,
  users,
  products,
  type ImageUploadEntity,
} from "@shared/schema";
import { sessionMiddleware, requireAuth } from "./middleware";
import { Permission, hasPermission, canMutateProducts } from "@shared/permissions";
import { writeImageVariants, removeImageVariants } from "../lib/image-storage";

function getUserSocietyId(req: Request): string {
  if (!req.user) throw new Error("Unauthorized");
  if (!req.user.societyId) throw new Error("User societyId not found in JWT");
  return req.user.societyId;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

function parseEntity(body: Record<string, unknown>): ImageUploadEntity | null {
  const parsed = imageUploadEntitySchema.safeParse(body.entity);
  return parsed.success ? parsed.data : null;
}

async function authorizeUpload(
  req: Request,
  entity: ImageUploadEntity,
  entityId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const user = req.user!;
  const societyId = getUserSocietyId(req);

  switch (entity) {
    case "society-logo":
    case "society-map": {
      if (!hasPermission(user.accessRole, Permission.SOCIETY_MANAGE)) {
        return { ok: false, status: 403, message: "Insufficient permissions" };
      }
      if (entityId !== societyId) {
        return { ok: false, status: 403, message: "Invalid society" };
      }
      return { ok: true };
    }
    case "user-avatar": {
      if (entityId !== user.id) {
        return { ok: false, status: 403, message: "You can only update your own avatar" };
      }
      return { ok: true };
    }
    case "product-image": {
      if (!canMutateProducts(user)) {
        return { ok: false, status: 403, message: "Product management not allowed" };
      }
      const [row] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, entityId), eq(products.societyId, societyId)))
        .limit(1);
      if (!row) {
        return { ok: false, status: 404, message: "Product not found" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, status: 400, message: "Unknown entity" };
  }
}

async function updateRowAfterUpload(
  entity: ImageUploadEntity,
  entityId: string,
  societyId: string,
  filename: string,
  oldFilename: string | null | undefined
) {
  await removeImageVariants(societyId, oldFilename);

  switch (entity) {
    case "society-logo":
      await db
        .update(societies)
        .set({ logoUrl: filename, updatedAt: new Date() })
        .where(and(eq(societies.id, entityId), eq(societies.id, societyId)));
      break;
    case "society-map":
      await db
        .update(societies)
        .set({ mapImageUrl: filename, updatedAt: new Date() })
        .where(and(eq(societies.id, entityId), eq(societies.id, societyId)));
      break;
    case "user-avatar":
      await db
        .update(users)
        .set({ avatarUrl: filename, updatedAt: new Date() })
        .where(and(eq(users.id, entityId), eq(users.societyId, societyId)));
      break;
    case "product-image":
      await db
        .update(products)
        .set({ imageUrl: filename, updatedAt: new Date() })
        .where(and(eq(products.id, entityId), eq(products.societyId, societyId)));
      break;
    default:
      break;
  }
}

async function readOldFilename(
  entity: ImageUploadEntity,
  entityId: string,
  societyId: string
): Promise<string | null | undefined> {
  switch (entity) {
    case "society-logo":
    case "society-map": {
      const [s] = await db
        .select({ logoUrl: societies.logoUrl, mapImageUrl: societies.mapImageUrl })
        .from(societies)
        .where(eq(societies.id, societyId))
        .limit(1);
      if (!s) return null;
      return entity === "society-logo" ? s.logoUrl : s.mapImageUrl;
    }
    case "user-avatar": {
      const [u] = await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(and(eq(users.id, entityId), eq(users.societyId, societyId)))
        .limit(1);
      return u?.avatarUrl;
    }
    case "product-image": {
      const [p] = await db
        .select({ imageUrl: products.imageUrl })
        .from(products)
        .where(and(eq(products.id, entityId), eq(products.societyId, societyId)))
        .limit(1);
      return p?.imageUrl;
    }
    default:
      return null;
  }
}

async function authorizeDelete(
  req: Request,
  entity: ImageUploadEntity,
  entityId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  return authorizeUpload(req, entity, entityId);
}

async function clearImageColumn(
  entity: ImageUploadEntity,
  entityId: string,
  societyId: string
): Promise<string | null | undefined> {
  const old = await readOldFilename(entity, entityId, societyId);
  await removeImageVariants(societyId, old);

  switch (entity) {
    case "society-logo":
      await db
        .update(societies)
        .set({ logoUrl: null, updatedAt: new Date() })
        .where(and(eq(societies.id, entityId), eq(societies.id, societyId)));
      break;
    case "society-map":
      await db
        .update(societies)
        .set({ mapImageUrl: null, updatedAt: new Date() })
        .where(and(eq(societies.id, entityId), eq(societies.id, societyId)));
      break;
    case "user-avatar":
      await db
        .update(users)
        .set({ avatarUrl: null, updatedAt: new Date() })
        .where(and(eq(users.id, entityId), eq(users.societyId, societyId)));
      break;
    case "product-image":
      await db
        .update(products)
        .set({ imageUrl: null, updatedAt: new Date() })
        .where(and(eq(products.id, entityId), eq(products.societyId, societyId)));
      break;
    default:
      break;
  }
  return old;
}

export function registerImageRoutes(app: Express) {
  app.post(
    "/api/images/upload",
    sessionMiddleware,
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      upload.single("image")(req, res, err => {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ message: err.message });
        }
        if (err) {
          return next(err);
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = req.file;
        if (!file?.buffer) {
          return res.status(400).json({ message: "Image file required (field: image)" });
        }

        const entity = parseEntity(req.body as Record<string, unknown>);
        if (!entity) {
          return res.status(400).json({ message: "Invalid entity" });
        }

        const entityId = typeof req.body.entityId === "string" ? req.body.entityId : "";
        if (!entityId) {
          return res.status(400).json({ message: "entityId required" });
        }

        const authz = await authorizeUpload(req, entity, entityId);
        if (!authz.ok) {
          return res.status(authz.status).json({ message: authz.message });
        }

        const societyId = getUserSocietyId(req);
        const oldFilename = await readOldFilename(entity, entityId, societyId);
        const stem = nanoid(16);

        const { filename, thumbFilename } = await writeImageVariants(societyId, stem, file.buffer);
        await updateRowAfterUpload(entity, entityId, societyId, filename, oldFilename);

        return res.status(200).json({
          url: filename,
          thumbUrl: thumbFilename,
          entity,
          entityId,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    "/api/images/:entity/:entityId",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsedEntity = imageUploadEntitySchema.safeParse(req.params.entity);
        if (!parsedEntity.success) {
          return res.status(400).json({ message: "Invalid entity" });
        }
        const entity = parsedEntity.data;
        const entityId = req.params.entityId;

        const authz = await authorizeDelete(req, entity, entityId);
        if (!authz.ok) {
          return res.status(authz.status).json({ message: authz.message });
        }

        const societyId = getUserSocietyId(req);
        await clearImageColumn(entity, entityId, societyId);
        return res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );
}
