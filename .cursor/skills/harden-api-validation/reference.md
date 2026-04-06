# Harden API validation — before / after

## Products POST (pattern today → hardened)

**Before (unchecked body):**

```typescript
const productData = req.body;
const societyId = getUserSocietyId(user);
const [newProduct] = await db
  .insert(products)
  .values({
    ...productData,
    societyId,
  })
  .returning();
```

**After (Zod + server societyId):**

```typescript
const parsed = insertProductSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    message: "Validation failed",
    issues: parsed.error.flatten(),
  });
}
const societyId = getUserSocietyId(user);
// Ensure insertProductSchema.pick omits societyId or strip it:
const { societyId: _ignored, ...fields } = parsed.data as Record<string, unknown>;
const [newProduct] = await db
  .insert(products)
  .values({
    ...fields,
    societyId,
  } as typeof products.$inferInsert)
  .returning();
```

Adjust typing: prefer inferring insert type from schema pick so `as` casts are minimal.

## Schema pick for API body

Omit **`societyId`** from `pick` when the server always sets it:

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
});
```

## Login body

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

## Error response shape

Keep consistent across routes: **`400`** + `message` + `issues` (flatten) for validation; **`401`/`403`** with `message` for auth; unexpected → **`next(err)`**.
