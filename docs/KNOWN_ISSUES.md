# Known issues and technical debt

This document records problems identified during codebase reviews (security, consistency, documentation, and tooling). **Verify each item** before treating it as still current; fix and remove or update the row when addressed.

---

## Multi-tenancy and data isolation

| Issue | Severity | Notes |
|-------|----------|--------|
| **`GET /api/tables` and related table routes** select from `tables` without `societyId` in the `where` clause. | High | [`server/routes/tables.ts`](../server/routes/tables.ts) — `tables` is tenant-scoped in schema; admins from society A could see or affect society B’s rows depending on route. |
| **`GET /api/tables/available`** same pattern — no `societyId` filter. | High | Same file. |
| **Treasurer credit endpoints** (`GET /api/credits`, `GET /api/credits/sum`, batch `PUT /api/credits/batch-status`) operate on `credits` without restricting to the treasurer’s society. | High | [`server/routes/debts.ts`](../server/routes/debts.ts) — `credits` includes `societyId` in schema but these queries filter only by month/status/ids. |
| **Product `PUT` / `DELETE`** use `eq(products.id, id)` only, not `and(..., eq(products.societyId, societyId))`. | Medium | Cross-tenant ID guessing could update/delete another society’s product. [`server/routes/products.ts`](../server/routes/products.ts). |
| **`POST /api/products`** spreads `req.body` including potential **`societyId` override** from the client before merging server `societyId`. | Medium | Trust boundary: client should not control tenant. Validate body with a schema that **omits** `societyId` or strip it after validation. |

---

## API input validation

| Issue | Severity | Notes |
|-------|----------|--------|
| **No Zod `safeParse` in route modules** (as of last check). | Medium | Project rule [`.cursor/rules/api-routes.mdc`](../.cursor/rules/api-routes.mdc) expects validation via `@shared/schema` drizzle-zod schemas; many handlers still use raw `req.body` or casts. |
| **Login and other auth bodies** use manual checks or `as` casts instead of shared schemas. | Medium | e.g. [`server/routes/index.ts`](../server/routes/index.ts) login handler. |

Use the **harden-api-validation** skill under [`.cursor/skills/harden-api-validation/`](../.cursor/skills/harden-api-validation/) for a consistent retrofit approach.

---

## Error handling

| Issue | Severity | Notes |
|-------|----------|--------|
| **Double error response** — some `catch` blocks call **`res.status(500).json(...)`** and then **`next(error)`**. | Medium | Can cause “headers already sent” or duplicate handling. Example pattern in [`server/routes/consumptions.ts`](../server/routes/consumptions.ts) (e.g. user consumptions fetch path). Prefer **either** send JSON **or** `next(err)`, not both. |
| **Verbose debug logging** in hot paths (e.g. reservation cancel). | Low | Noise and possible PII in logs; review [`server/routes/reservations.ts`](../server/routes/reservations.ts) for `console.error` debug blocks. |

---

## TypeScript and code quality

| Issue | Severity | Notes |
|-------|----------|--------|
| Widespread **`any`** in routes and client (JWT casts, `updateData`, event handlers, API mappers). | Low–Medium | Weakens guarantees; examples include [`server/routes/debts.ts`](../server/routes/debts.ts) (`updateData`), [`server/routes/backoffice.ts`](../server/routes/backoffice.ts), [`client/src/pages/UsersPage.tsx`](../client/src/pages/UsersPage.tsx), dashboard API helpers. |
| **Duplicated `getUserSocietyId`** (and similar helpers) across many route files instead of one shared import-safe module. | Low | Risk of drift; [`server/routes/index.ts`](../server/routes/index.ts) exports a canonical copy but route files cannot import from `index` without cycles — consider `server/lib/` extraction. |
| **Two `sessionMiddleware` implementations** (global registration in `index.ts` vs [`server/routes/middleware.ts`](../server/routes/middleware.ts)). | Low | Same idea in two places — changes can diverge. |

---

## Internationalization (client)

| Issue | Severity | Notes |
|-------|----------|--------|
| **Hardcoded UI strings** (Basque, Spanish, or English) outside `t()`. | Medium | Hurts consistency and ES coverage. Examples called out in review: dashboard widgets, some forms/placeholders — run an **audit-i18n** pass ([`.cursor/skills/audit-i18n/`](../.cursor/skills/audit-i18n/)). |
| **`eu` / `es` key parity** in [`client/src/lib/i18n.ts`](../client/src/lib/i18n.ts) may drift. | Low | Manual comparison or scripted diff of key sets. |

---

## Documentation drift

| Issue | Severity | Notes |
|-------|----------|--------|
| **[`docs/features/IMPLEMENTATION_STATUS.md`](features/IMPLEMENTATION_STATUS.md)** vs **story files** under `docs/features/*.md` — some stories marked not implemented while status says done (e.g. authentication/profile stories). | Low | Workflow rule: treat status doc as shipped truth until specs are reconciled. |
| **Credits / Zorrak** — status may understate backend work (real `/api/credits` routes exist while some rows were marked mock/UI-only in past reviews). | Low | Reconcile status with [`server/routes/debts.ts`](../server/routes/debts.ts) and UI. |
| **Root docs inconsistency** — e.g. [`README.md`](../README.md) vs [`package.json`](../package.json) `engines` (Node version), product naming in [`INSTALLATION_UBUNTU_24.md`](../INSTALLATION_UBUNTU_24.md), icon stack in [`TECHNICAL_DOCUMENTATION.md`](../TECHNICAL_DOCUMENTATION.md) vs [`design_guidelines.md`](../design_guidelines.md). | Low | Onboarding confusion only. |

---

## Security and configuration

| Issue | Severity | Notes |
|-------|----------|--------|
| **Default `JWT_SECRET`** in code if env unset. | High (production) | [`server/routes/middleware.ts`](../server/routes/middleware.ts) and [`server/routes/index.ts`](../server/routes/index.ts) — use a strong `JWT_SECRET` in production; [`.env.example`](../.env.example) documents dev placeholders. |

---

## Repository and tooling

| Issue | Severity | Notes |
|-------|----------|--------|
| **Two lockfiles** (`pnpm-lock.yaml` and `package-lock.json`) — pick one package manager. | Low | Avoid divergent installs. |
| **No CI workflows in-repo** (no `.github/workflows` found in review). | Medium | No automated `pnpm check`, lint, or E2E on push. |
| **No unit test runner** in use — E2E only (`pnpm test:e2e`). | Low | `tsconfig` excludes `*.test.ts`; riskier refactors without fast tests. |
| **Two DB reset scripts** — [`script/reset-database-push.ts`](../script/reset-database-push.ts) (used by `pnpm db:reset`) vs [`script/reset-database.ts`](../script/reset-database.ts) with a smaller table list; easy for the legacy script to drift. | Low | Prefer one canonical path. |

---

## End-to-end test coverage gaps

Areas with API routes but **no dedicated** matching `e2e/features/*.feature` in a past inventory (names may change):

- Tables, notes, notifications, subscription types, categories, SEPA, backoffice.

Login and other flows still provide partial coverage. Use [`.cursor/skills/create-e2e-test/`](../.cursor/skills/create-e2e-test/) when adding scenarios.

---

## Related project guidance

- Cursor rules: [`.cursor/rules/`](../.cursor/rules/)
- Feature specs and status: [`docs/features/README.md`](features/README.md), [`IMPLEMENTATION_STATUS.md`](features/IMPLEMENTATION_STATUS.md)
