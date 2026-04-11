# Audit tenancy (society scoping)

Audit Express API routes for multi-tenant societyId scoping bugs in Drizzle queries. Flags selects/updates/deletes on tenant tables that omit society filters.

## Goal

Find queries in `server/routes/**/*.ts` that touch **tenant-scoped** tables without restricting rows to the authenticated user's **`societyId`** (from JWT).

## Steps

1. Read the known-global-tables reference below for exceptions and severity rubric.
2. List route files: `server/routes/*.ts`. Treat **backoffice** separately (different auth model).
3. For each file, locate `db.select`, `db.update`, `db.delete`, and `db.insert` (inserts should set `societyId` from server, not trust body).
4. For each query on a table that has `societyId` in `shared/schema.ts`:
   - **Read:** `where` must include `eq(table.societyId, societyId)` or equivalent.
   - **Update/delete by id:** must use `and(eq(table.id, id), eq(table.societyId, societyId))` so another tenant's id cannot be mutated.
5. Confirm `societyId` is derived from `req.user` after `requireAuth` — same logic as `getUserSocietyId` in `server/routes/index.ts`.
6. Produce a report: **file**, **route method + path**, **severity**, **issue**, **suggested fix** (short code snippet).

## Search aids

- Grep: `db\.(select|update|delete|insert)` in `server/routes/`
- Grep: `from(users)` / `from(credits)` / `from(tables)` etc., then read full handler for `where`
- Flag handlers using **only** `eq(table.id, req.params.id)` on tenant tables

## Fix pattern

```typescript
const societyId = getUserSocietyId(req.user!);
// ...
.where(and(eq(widgets.id, id), eq(widgets.societyId, societyId)));
```

## Out of scope

- Client-side-only code
- Seeding scripts (they use service DB credentials intentionally)
- Schema definition files

## After fixes

- `pnpm check`
- Add or extend integration/E2E tests if the bug was user-visible
- Update `docs/features/IMPLEMENTATION_STATUS.md` if behavior changes

---

## Known global tables / special cases

### Tables with no `societyId` column

- **`superadmins`** — backoffice-only; scoped by backoffice auth, not society JWT.

### `societies` table

- Rows are tenants. `GET /api/societies` listing all societies may be intentional for admin/backoffice flows; verify product expectations.
- For normal member/treasurer APIs, users should only read/update **their** `societyId` from `req.user`.

### Tenant-scoped tables (must usually filter by `societyId`)

All of these include `societyId` in `shared/schema.ts` (verify after schema changes):

`users`, `products`, `product_categories`, `category_messages`, `consumptions`, `consumption_items`, `stock_movements`, `reservations`, `credits`, `notes`, `note_messages`, `tables`, `notifications`, `notification_messages`, `subscription_types`.

Any `select` / `update` / `delete` on these from a society app route must enforce the caller's society (from JWT via `getUserSocietyId`), unless the handler is explicitly cross-tenant and authorized (rare).

### Routes to review carefully

- **Backoffice** (`server/routes/backoffice.ts`) — uses different auth; rules differ.
- **`/api/login`**, **`/api/refresh`**, **`/api/logout`** — no tenant row access.

### Severity rubric

| Finding | Severity |
|---------|----------|
| `GET` list without `societyId` on tenant table | High (data leak across tenants) |
| `PUT`/`DELETE` by id without `societyId` guard | Critical (cross-tenant write) |
| Aggregations / sums without society filter | High |
