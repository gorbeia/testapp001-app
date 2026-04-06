# Known issues and technical debt

This document records problems identified during codebase reviews (security, consistency, documentation, and tooling). **Verify each item** before treating it as still current; fix and remove or update the row when addressed.

---

## Multi-tenancy and data isolation

_No open items from the last review._

---

## API input validation

_POST/PUT/PATCH handlers that accept JSON bodies in [`server/routes/`](../server/routes/) now validate with **`safeParse`** and schemas exported from [`shared/schema.ts`](../shared/schema.ts) (including `loginBodySchema` and backoffice login). When adding new endpoints, follow [`.cursor/rules/api-routes.mdc`](../.cursor/rules/api-routes.mdc) and the [harden-api-validation skill](../.cursor/skills/harden-api-validation/SKILL.md)._

---

## Error handling

_No open items from the last review._ (`next(err)` for unexpected errors; global handler in [`server/index.ts`](../server/index.ts).)

---

## TypeScript and code quality

| Issue                                                                                                                                               | Severity   | Notes                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Widespread **`any`** in routes and client (JWT casts, `updateData`, event handlers, API mappers).                                                   | Low–Medium | Weakens guarantees; examples include [`server/routes/debts.ts`](../server/routes/debts.ts) (`updateData`), [`server/routes/backoffice.ts`](../server/routes/backoffice.ts), [`client/src/pages/UsersPage.tsx`](../client/src/pages/UsersPage.tsx), dashboard API helpers. |
| **Duplicated `getUserSocietyId`** (and similar helpers) across many route files instead of one shared import-safe module.                           | Low        | Risk of drift; [`server/routes/index.ts`](../server/routes/index.ts) exports a canonical copy but route files cannot import from `index` without cycles — consider `server/lib/` extraction.                                                                              |
| **Two `sessionMiddleware` implementations** (global registration in `index.ts` vs [`server/routes/middleware.ts`](../server/routes/middleware.ts)). | Low        | Same idea in two places — changes can diverge.                                                                                                                                                                                                                            |

---

## Internationalization (client)

| Issue                                                                                          | Severity | Notes                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hardcoded UI strings** (Basque, Spanish, or English) outside `t()`.                          | Medium   | Hurts consistency and ES coverage. Examples called out in review: dashboard widgets, some forms/placeholders — run an **audit-i18n** pass ([`.cursor/skills/audit-i18n/`](../.cursor/skills/audit-i18n/)). |
| **`eu` / `es` key parity** in [`client/src/lib/i18n.ts`](../client/src/lib/i18n.ts) may drift. | Low      | Manual comparison or scripted diff of key sets.                                                                                                                                                            |

---

## Documentation drift

Keeping feature stories and [`IMPLEMENTATION_STATUS.md`](features/IMPLEMENTATION_STATUS.md) aligned is covered by [`.cursor/rules/feature-workflow.mdc`](../.cursor/rules/feature-workflow.mdc), not an open product defect.

Root onboarding docs ([`README.md`](../README.md), [`INSTALLATION_UBUNTU_24.md`](../INSTALLATION_UBUNTU_24.md), [`TECHNICAL_DOCUMENTATION.md`](../TECHNICAL_DOCUMENTATION.md), [`docs/design_guidelines.md`](design_guidelines.md)) were reconciled for Node **`engines`**, **Elkartearen App** vs **Gure Txokoa** naming, **Lucide** icons, JWT auth description, and **E2E-only** testing.

---

## Security and configuration

| Issue                                          | Severity          | Notes                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default `JWT_SECRET`** in code if env unset. | High (production) | [`server/routes/middleware.ts`](../server/routes/middleware.ts) and [`server/routes/index.ts`](../server/routes/index.ts) — use a strong `JWT_SECRET` in production; [`.env.example`](../.env.example) documents dev placeholders. |

---

## Repository and tooling

CI is documented in the root [README](../README.md) (workflows: [`.github/workflows/`](../.github/workflows/) — `ci.yml`, `e2e.yml`, `security-audit.yml`).

| Issue                                                                                                                                                                                                                                                 | Severity | Notes                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| **No unit test runner** in use — E2E only (`pnpm test:e2e`).                                                                                                                                                                                          | Low      | `tsconfig` excludes `*.test.ts`; riskier refactors without fast tests.                                |

## End-to-end test coverage gaps

Areas with API routes but **no dedicated** matching `e2e/features/*.feature` in a past inventory (names may change):

- Tables, notes, notifications, subscription types, categories, SEPA, backoffice.

Login and other flows still provide partial coverage. Use [`.cursor/skills/create-e2e-test/`](../.cursor/skills/create-e2e-test/) when adding scenarios.

---

## Related project guidance

- Cursor rules: [`.cursor/rules/`](../.cursor/rules/)
- Feature specs and status: [`docs/features/README.md`](features/README.md), [`IMPLEMENTATION_STATUS.md`](features/IMPLEMENTATION_STATUS.md)
