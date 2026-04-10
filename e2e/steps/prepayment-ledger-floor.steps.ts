import { After, Before, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { getPage } from "./shared-state";

Before({ tags: "@prepayment-ledger-floor" }, function () {
  execFileSync("pnpm", ["exec", "tsx", "script/seed-prepayment-floor-e2e.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
});

After({ tags: "@prepayment-ledger-floor" }, function () {
  try {
    execFileSync("pnpm", ["exec", "tsx", "script/seed-prepayment-floor-e2e.ts", "--undo"], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    console.error(
      "prepayment-ledger-floor teardown failed (run `pnpm db:push` if prepayment_min_ledger_balance is missing)"
    );
  }
});

Then("I should see the prepayment ledger floor banner", async function () {
  const page = getPage();
  assert.ok(page, "Page not available");
  await page
    .getByTestId("banner-prepayment-ledger-floor")
    .waitFor({ state: "visible", timeout: 15000 });
});

Then(
  "the reservation save button should be disabled for prepayment ledger floor",
  async function () {
    const page = getPage();
    assert.ok(page, "Page not available");
    const btn = page.getByTestId("button-save-reservation");
    await btn.waitFor({ state: "visible", timeout: 10000 });
    assert.strictEqual(
      await btn.isDisabled(),
      true,
      "Save should be disabled when below prepayment floor"
    );
  }
);
