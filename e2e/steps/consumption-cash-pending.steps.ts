import { Before, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPage } from "./shared-state";

/** Paying the seeded reservation records ledger rows; reruns would see an empty list without this. */
Before({ tags: "@consumption-cash-pending" }, function () {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  execSync("pnpm exec tsx script/repair-cash-pos-e2e-state.ts", {
    cwd: repoRoot,
    stdio: "pipe",
    env: { ...process.env },
  });
});

const SEEDED_PENDING_RESERVATION_TESTID =
  "pending-card-reservation-b2c3d4e5-f6a7-4890-bcde-f10000000001";

When(
  "I open the pending payments category on the consumptions page",
  { timeout: 6_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page not available");
    const pendingResponse = page.waitForResponse(
      res => res.url().includes("/api/me/pending-cash-items") && res.ok(),
      { timeout: 5_000 }
    );
    await page.getByTestId("button-filter-pending-payments").click();
    await pendingResponse;
    await page.waitForTimeout(300);
  }
);

Then("I should not see pending payments category on the consumptions page", async function () {
  const page = getPage();
  assert.ok(page, "Page not available");
  const count = await page.getByTestId("button-filter-pending-payments").count();
  assert.equal(count, 0, "Pending payments filter should not be rendered when cash is disabled");
});

Then(
  "I should see the seeded pending reservation card for cash E2E",
  { timeout: 6_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page not available");
    const card = page.getByTestId(SEEDED_PENDING_RESERVATION_TESTID);
    await card.waitFor({ state: "visible", timeout: 5_000 });
  }
);

Then(
  "I should not see the seeded pending reservation card for cash E2E",
  { timeout: 6_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page not available");
    const card = page.getByTestId(SEEDED_PENDING_RESERVATION_TESTID);
    assert.equal(
      await card.count(),
      0,
      "Reservation should be removed from pending list after cash pay"
    );
  }
);

When(
  "I add the seeded pending reservation to the cart on the consumptions page",
  { timeout: 6_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page not available");
    await page.getByTestId("button-add-reservation-b2c3d4e5-f6a7-4890-bcde-f10000000001").click();
    await page.waitForTimeout(400);
  }
);

Then("I should see consumptions save success", { timeout: 6_000 }, async function () {
  const page = getPage();
  assert.ok(page, "Page not available");
  await page.waitForTimeout(400);
  const err = page.locator('[data-testid="toast-destructive"]');
  if (await err.isVisible()) {
    const msg = await err.textContent();
    throw new Error(`Expected success toast but got error: ${msg}`);
  }
  const ok = page.locator('[data-testid="toast-default"]');
  await ok.waitFor({ state: "visible", timeout: 5_000 });
});
