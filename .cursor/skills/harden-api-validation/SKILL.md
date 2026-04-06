---
name: harden-api-validation
description: >-
  Adds Zod validation (drizzle-zod insert/update schemas from shared/schema)
  to Express POST/PUT/PATCH handlers that currently use raw req.body. Use when
  the user asks to harden routes, add validation, add Zod/safeParse, or
  retrofit API input validation.
---

# Harden API validation

## Goal

Align **`server/routes/**/*.ts`** with `.cursor/rules/api-routes.mdc`: validate request bodies before writes using schemas from **`@shared/schema`**.

## Steps

1. **Inventory handlers** — Find `app.post`, `app.put`, `app.patch` in `server/routes/*.ts` (and inline routes in `server/routes/index.ts` such as login).
2. **Map to schema** — For each body payload, find or create `insert*Schema` / `createInsertSchema(table).pick({...})` in [`shared/schema.ts`](shared/schema.ts). Extend `pick` to match fields the API accepts (omit `societyId` if set server-side).
3. **PATCH/PUT** — If partial updates, use `.pick` subset or `insertSchema.partial()` / dedicated `z.object` — must still reject unknown dangerous fields.
4. **Implement** — At start of handler:

   ```typescript
   const parsed = insertFooSchema.safeParse(req.body);
   if (!parsed.success) {
     return res.status(400).json({
       message: "Validation failed",
       issues: parsed.error.flatten(),
     });
   }
   ```

   Then use **`parsed.data`** only (spread into `insert`/`set` after merging server-only fields like `societyId`).

5. **Login / auth** — Replace ad-hoc casts with a small Zod schema in `index.ts` or `middleware.ts` (email, password, societyId) for `/api/login`.

6. **Do not double-send errors** — On validation failure return JSON only; on unexpected errors use **`next(err)`** only (avoid both `res.status(500).json` and `next(err)`).

7. **Verify** — `pnpm check`; exercise critical paths manually or via E2E.

## Special cases

- **Nested JSON** — Use `z.object({ ... })` or extend drizzle-zod output with `.extend`.
- **Coercion** — Use `z.coerce.number()` if query/body types are stringy and DB expects numbers (prefer consistent client JSON types).

## Reference

Before/after patterns: [reference.md](reference.md)
