---
name: create-e2e-test
description: >-
  Adds Cucumber feature files and Playwright step definitions for this repo's
  E2E suite. Follows e2e/steps/shared-state.ts, data-testid selectors, and
  pnpm test:e2e scripts. Use when the user asks to create an e2e test, add
  Playwright coverage, write a Gherkin feature, or extend browser tests.
---

# Create E2E test (Cucumber + Playwright)

## Preconditions

- Dev app URL matches **`E2E_BASE_URL`**, or **`VITE_API_URL`**, or **`http://localhost:${PORT}`** (see `e2e/steps/base-url.ts`).
- Database seeded with credentials used by login steps (**`GT001`**, **`demo`**, admin user — see README / `login.steps.ts`).
- Run **`pnpm dev`** in a separate terminal before **`pnpm test:e2e`**.

## Workflow

1. **Clarify scope** — Feature name, role(s), scenarios (happy path + one failure path if useful).
2. **Feature file** — Create `e2e/features/<topic>.feature`:
   - `Feature:` line, `Background:` with `Given the application is running`, login, navigation
   - `Scenario:` / `Scenario Outline:` with clear `When`/`Then` steps
   - Use **`@only`** on a scenario temporarily for focused runs (`pnpm test:e2e:only`)
3. **Steps** — Create or extend `e2e/steps/<topic>.steps.ts`:
   - Import `Given`, `When`, `Then` from `@cucumber/cucumber`
   - Import **`getPage`** from `./shared-state`
   - Every step: `const page = getPage(); if (!page) throw new Error("Page not available");`
4. **Selectors** — Prefer **`[data-testid="..."]`**, **`role`**, **`aria-label`**, or stable text matching Basque UI copy. **Avoid** Tailwind class selectors.
5. **Reuse** — Reuse steps from `login.steps.ts`, `product-management.steps.ts`, etc., when the wording matches exactly.
6. **Add testids** — If the UI lacks hooks, add `data-testid` in React (client) first, then write steps.
7. **Seed data** — If scenarios need specific rows, add or extend `script/seed-*.ts` and document dependency on **`pnpm db:seed`**.
8. **Run** — `pnpm test:e2e:feature -- e2e/features/<topic>.feature` then full `pnpm test:e2e`.

## Do not

- Start/stop the dev server inside Cucumber unless an existing step already does (default **Given the application is running** is often a no-op).
- Rely on machine translation timing without `waitForLoadState` / explicit waits on selectors.

## Reference

Examples: [reference.md](reference.md)
