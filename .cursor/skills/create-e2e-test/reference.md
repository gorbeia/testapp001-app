# Create E2E test — reference

## Feature file skeleton

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

Remove **`@only`** before committing, or keep one scenario tagged only for local debugging.

## Step definitions skeleton

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

Align **click text** with real sidebar label from `AppSidebar` / i18n.

## Selector examples (from product-management)

```typescript
await page.click('[data-testid="button-new-product"]');
await page.fill('[data-testid="input-product-name"]', name);
await page.click('[data-testid="select-product-category"]');
await page.waitForSelector('[role="option"]');
await page.click(`[role="option"]:has-text("${category}")`);
```

## Dynamic values

Store on World / `this` for reuse:

```typescript
(this as { currentProductName?: string }).currentProductName = productName;
```

## Commands

```bash
pnpm db:seed
# Ensure .env PORT/VITE_API_URL (or E2E_BASE_URL) match pnpm dev
pnpm dev   # terminal 1
pnpm test:e2e:feature -- e2e/features/my-feature.feature   # terminal 2
pnpm test:e2e:only   # runs @only tagged scenarios
```

Use **`import { getPage, e2eUrl } from "./shared-state"`** and **`e2eUrl("/path")`** instead of hardcoded origins.
