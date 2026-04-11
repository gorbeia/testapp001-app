# Create E2E test (Cucumber + Playwright)

Add Cucumber feature files and Playwright step definitions for this repo's E2E suite.

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

- Start/stop the dev server inside Cucumber unless an existing step already does.
- Rely on timing without `waitForLoadState` / explicit waits on selectors.
- Leave `@only` tags on scenarios before committing.

---

## Reference

### Feature file skeleton

```gherkin
Feature: Tables management
  As an admin
  I want to manage tables
  So that reservations have capacity

  Background:
    Given the application is running
    And I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form
    And I navigate to the tables page

  @only
  Scenario: See tables list
    Then I should see the tables heading
```

Remove **`@only`** before committing.

### Step definitions skeleton

```typescript
import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage } from "./shared-state";

Given("I navigate to the tables page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click("text=Mahaiak");
  await page.waitForLoadState("networkidle");
});

Then("I should see the tables heading", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  const heading = page.getByRole("heading", { name: /mahai/i });
  await heading.waitFor({ state: "visible" });
  assert.ok(await heading.isVisible());
});
```

Align click text with the real sidebar label from `AppSidebar` / i18n.

### Selector examples

```typescript
await page.click('[data-testid="button-new-product"]');
await page.fill('[data-testid="input-product-name"]', name);
await page.click('[data-testid="select-product-category"]');
await page.waitForSelector('[role="option"]');
await page.click(`[role="option"]:has-text("${category}")`);
```

### Storing dynamic values across steps

```typescript
(this as { currentProductName?: string }).currentProductName = productName;
```

### Commands

```bash
pnpm db:seed
pnpm dev                                                          # terminal 1
pnpm test:e2e:feature -- e2e/features/my-feature.feature         # terminal 2
pnpm test:e2e:only    # runs @only tagged scenarios
```

Use **`import { getPage, e2eUrl } from "./shared-state"`** and **`e2eUrl("/path")`** instead of hardcoded origins.
