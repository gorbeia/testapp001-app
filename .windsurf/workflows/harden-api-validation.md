---
description: Harden API validation — Add Zod validation to Express POST/PUT/PATCH handlers using drizzle-zod schemas
---

# Harden API validation

Add Zod validation (drizzle-zod insert/update schemas from `shared/schema`) to Express POST/PUT/PATCH handlers that currently use raw `req.body`.

## Goal

Align `server/routes/**/*.ts` with the api-routes conventions in rules.md: validate request bodies before writes using schemas from **`@shared/schema`**.

## Steps

1. **Inventory handlers** — Find `app.post`, `app.put`, `app.patch` in `server/routes/*.ts` (and inline routes in `server/routes/index.ts` such as login).
2. **Map to schema** — For each body payload, find or create `insert*Schema` / `createInsertSchema(table).pick({...})` in `shared/schema.ts`. Extend `pick` to match fields the API accepts (omit `societyId` if set server-side).
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

5. **Login / auth** — Replace ad-hoc casts with a small Zod schema in `index.ts` or `middleware.ts` for `/api/login`.

6. **Do not double-send errors** — On validation failure return JSON only; on unexpected errors use `next(err)` only.

7. **Verify** — `pnpm check`; exercise critical paths manually or via integration tests.

## Special cases

- **Nested JSON** — Use `z.object({ ... })` or extend drizzle-zod output with `.extend`.
- **Coercion** — Use `z.coerce.number()` if body types are stringy and DB expects numbers.

---

## Reference — before / after patterns

### POST handler (unchecked → hardened)

**Before:**

```typescript
const productData = req.body;
const societyId = getUserSocietyId(user);
const [newProduct] = await db
  .insert(products)
  .values({ ...productData, societyId })
  .returning();
```

**After:**

```typescript
const parsed = insertProductSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    message: "Validation failed",
    issues: parsed.error.flatten(),
  });
}
const societyId = getUserSocietyId(user);
const [newProduct] = await db
  .insert(products)
  .values({ ...parsed.data, societyId })
  .returning();
```

### Schema pick (omit societyId)

```typescript
export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  categoryId: true,
  price: true,
  stock: true,
  unit: true,
  minStock: true,
  supplier: true,
  isActive: true,
  // societyId omitted — server sets it from JWT
});
```

### Login body schema

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  societyId: z.string().min(1),
});
const parsed = loginSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ message: "Validation failed", issues: parsed.error.flatten() });
}
const { email, password, societyId } = parsed.data;
```

### Error response shape

- `400` + `message` + `issues` (flatten) for validation failures
- `401`/`403` with `message` for auth failures
- Unexpected errors → `next(err)` (global handler returns `500`)
