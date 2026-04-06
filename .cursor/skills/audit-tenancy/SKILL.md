---
name: audit-tenancy
description: >-
  Audits Express API routes for multi-tenant societyId scoping bugs in Drizzle
  queries. Flags selects/updates/deletes on tenant tables that omit society
  filters. Use when the user asks for a tenancy audit, society scoping check,
  multi-tenant security review, or data leak review on API routes.
---

# Audit tenancy (society scoping)

## Goal

Find queries in **`server/routes/**/\*.ts`** that touch **tenant-scoped** tables (see [known-global-tables.md](known-global-tables.md)) without restricting rows to the authenticated user’s **`societyId`\*\* (from JWT).

## Steps

1. Read [known-global-tables.md](known-global-tables.md) for exceptions and severity rubric.
2. List route files (exclude pure middleware if split): `server/routes/*.ts`. Treat **backoffice** separately (different auth model).
3. For each file, locate **`db.select`**, **`db.update`**, **`db.delete`**, and **`db.insert`** (inserts should set `societyId` from server, not trust body).
4. For each query on a table that has **`societyId`** in `shared/schema.ts`:
   - **Read:** `where` must include `eq(table.societyId, societyId)` or an equivalent join that restricts to the user’s society.
   - **Update/delete by id:** must use `and(eq(table.id, id), eq(table.societyId, societyId))` (or subquery) so another tenant’s id cannot be mutated.
5. Confirm **`societyId`** is derived from **`req.user`** after `requireAuth` — e.g. same logic as **`getUserSocietyId`** in `server/routes/index.ts`.
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
- Schema definition files unless documenting new tables for the known-global list

## After fixes

- Run **`pnpm check`**
- Add or extend E2E if the bug was user-visible
- Update **`docs/features/IMPLEMENTATION_STATUS.md`** if behavior was documented as mock-only but is now real (or vice versa)
