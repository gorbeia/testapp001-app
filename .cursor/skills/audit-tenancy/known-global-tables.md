# Tenancy audit — global / special cases

Use this list to reduce **false positives** when auditing `server/routes/**/*.ts`.

## Tables with no `societyId` column

- **`superadmins`** — backoffice-only; scoped by backoffice auth, not society JWT.

## `societies` table

- Rows are tenants. **`GET /api/societies` listing all societies** may be intentional for **admin/backoffice** flows; verify product expectations.
- For **normal member/treasurer** APIs, users should usually only read/update **their** `societyId` from `req.user`.

## Tenant-scoped tables (must usually filter by `societyId`)

All of these include **`societyId`** in `shared/schema.ts` (verify after schema changes):

`users`, `products`, `product_categories`, `category_messages`, `consumptions`, `consumption_items`, `stock_movements`, `reservations`, `credits`, `notes`, `note_messages`, `tables`, `notifications`, `notification_messages`, `subscription_types`.

Any `select` / `update` / `delete` on these from a **society app** route must enforce the caller’s society (from JWT via `getUserSocietyId`), unless the handler is explicitly cross-tenant and authorized (rare).

## Routes to review carefully

- **Backoffice** (`server/routes/backoffice.ts`) — uses different auth; rules differ.
- **`/api/login`**, **`/api/refresh`**, **`/api/logout`** — no tenant row access.

## Severity rubric

| Finding                                        | Severity                        |
| ---------------------------------------------- | ------------------------------- |
| `GET` list without `societyId` on tenant table | High (data leak across tenants) |
| `PUT`/`DELETE` by id without `societyId` guard | Critical (cross-tenant write)   |
| Aggregations / sums without society filter     | High                            |
