# Scaffold feature (Elkartetippia)

Scaffold a new tenant-scoped domain feature end-to-end: Drizzle schema, Express routes, client page, routing, sidebar, i18n, and docs.

## Before coding

Confirm with the user (or infer from context):

- Entity name and DB table name(s)
- Fields and types (`varchar`, `text`, `integer`, `boolean`, FKs)
- Which roles can access the UI (`ProtectedRoute` / sidebar — see existing `App.tsx` / `AppSidebar.tsx`)
- Basque route slug (e.g. `/gertaerak`) and nav label keys
- Whether seed data is needed (`script/seed-*.ts` + register in `script/seed.ts`)

## Checklist (track as you go)

```
- [ ] shared/schema.ts — pgTable + insert*Schema (drizzle-zod)
- [ ] (No change) script/reset.ts — dynamic drop; new tables need no reset-script edit
- [ ] server/routes/<feature>.ts — registerXRoutes, middleware, tenancy, Zod safeParse
- [ ] server/routes/index.ts — import + registerXRoutes(app)
- [ ] client/src/pages/<Feature>Page.tsx — Query + RHF + shadcn
- [ ] client/src/App.tsx — Route + ProtectedRoute
- [ ] client/src/components/AppSidebar.tsx — nav item + access
- [ ] client/src/lib/i18n.ts — eu + es keys
- [ ] docs/features/<feature>.md + IMPLEMENTATION_STATUS.md
- [ ] Optional: script/seed-<feature>.ts + call from script/seed.ts
- [ ] Optional: e2e/features + e2e/steps (use /create-e2e-test)
```

## Rules

- **Tenancy:** reads/writes on tenant tables must filter by `societyId` from the JWT user. Updates/deletes: `and(eq(table.id, id), eq(table.societyId, societyId))`.
- **Validation:** validate `req.body` with `@shared/schema` insert schema + `safeParse` before insert/update.
- **`getUserSocietyId`:** route modules **cannot** import from `./index` (circular). Inline the same 5-line helper or extract to a `server/lib/` module.
- **i18n:** every new UI string in **eu** and **es**.

## After implementation

- `pnpm check`
- `pnpm db:reset:seed` or `pnpm db:push` as appropriate
- Smoke-test the new route in the browser

---

## Reference templates

### Drizzle table + insert schema (`shared/schema.ts`)

```typescript
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const widgets = pgTable("widgets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWidgetSchema = createInsertSchema(widgets).pick({
  name: true,
  // Omit societyId — set server-side from JWT
});
```

### Route module skeleton (`server/routes/widgets.ts`)

```typescript
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { widgets, insertWidgetSchema } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";
import type { User } from "@shared/schema";

function getUserSocietyId(user: User): string {
  if (!user.societyId) throw new Error("User societyId not found in JWT");
  return user.societyId;
}

export function registerWidgetRoutes(app: Express) {
  app.get(
    "/api/widgets",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const societyId = getUserSocietyId(req.user!);
        const rows = await db.select().from(widgets).where(eq(widgets.societyId, societyId));
        return res.status(200).json(rows);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    "/api/widgets",
    sessionMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = insertWidgetSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: "Validation failed", issues: parsed.error.flatten() });
        }
        const societyId = getUserSocietyId(req.user!);
        const [row] = await db
          .insert(widgets)
          .values({ ...parsed.data, societyId })
          .returning();
        return res.status(201).json(row);
      } catch (err) {
        next(err);
      }
    }
  );
}
```

Register in `server/routes/index.ts`:

```typescript
import { registerWidgetRoutes } from "./widgets";
// inside registerRoutes:
registerWidgetRoutes(app);
```

### Client page (minimal)

- `useQuery` for `GET /api/widgets` via `authFetch` or `apiRequest`
- `useMutation` + `invalidateQueries` on success
- Form: `useForm` + `zodResolver` + Zod schema mirroring insert fields
- Add `data-testid` on primary actions/inputs if E2E will cover the feature

### App routing

Mirror patterns in `client/src/App.tsx`: `Route` path, `ProtectedRoute`, layout wrapper.

### Sidebar

Mirror `client/src/components/AppSidebar.tsx`: role checks and `t("...")` labels.
