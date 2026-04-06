# Scaffold feature — reference templates

## Drizzle table + insert schema (`shared/schema.ts`)

```typescript
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Example: tenant-scoped entity (import `societies` from the same file’s existing definition)
export const widgets = pgTable("widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWidgetSchema = createInsertSchema(widgets).pick({
  name: true,
  // Omit societyId from client body — set server-side from JWT
});
```

Add **`societyId: true`** to the pick only if the API is designed to accept it (usually **omit** and set in the handler).

## Reset script (`script/reset-database-push.ts`)

Add `DROP TABLE IF EXISTS "widgets" CASCADE;` in **dependency order** (children before parents if not using CASCADE consistently — this script uses CASCADE on each line).

## Route module skeleton (`server/routes/widgets.ts`)

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
        const rows = await db
          .select()
          .from(widgets)
          .where(eq(widgets.societyId, societyId));
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
          return res.status(400).json({ message: "Validation failed", issues: parsed.error.flatten() });
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

## Client page (minimal)

- `useQuery` for `GET /api/widgets` via `authFetch` or `apiRequest`
- `useMutation` + `invalidateQueries` on success
- Form: `useForm` + `zodResolver` + Zod schema mirroring insert fields
- Add `data-testid` on primary actions/inputs if E2E will cover the feature

## App routing

Mirror patterns in `client/src/App.tsx`: `Route` path, `ProtectedRoute`, layout wrapper.

## Sidebar

Mirror `client/src/components/AppSidebar.tsx`: role checks and `t("...")` labels.
