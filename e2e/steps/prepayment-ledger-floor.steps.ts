import { After, Before, Then, When } from "@cucumber/cucumber";
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

Then("the reservation save button should be disabled for prepayment ledger floor", async function () {
  const page = getPage();
  assert.ok(page, "Page not available");
  const btn = page.getByTestId("button-save-reservation");
  await btn.waitFor({ state: "visible", timeout: 10000 });
  assert.strictEqual(await btn.isDisabled(), true, "Save should be disabled when below prepayment floor");
});

When("I request creating a reservation via the API from the browser session", async function () {
  const page = getPage();
  assert.ok(page, "Page not available");
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem("auth:token");
    const res = await fetch("/api/reservations", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: "E2E prepayment floor API",
        type: "bazkaria",
        startDate: new Date().toISOString(),
        guests: 10,
        useKitchen: false,
        table: "Gela Pribatua",
        totalAmount: "20",
        notes: "",
      }),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    return { status: res.status, body };
  });
  (this as { prepaymentFloorApiResult?: { status: number; body: unknown } }).prepaymentFloorApiResult =
    result;
});

Then("the response should be prepayment ledger floor denied", async function () {
  const result = (this as { prepaymentFloorApiResult?: { status: number; body: unknown } })
    .prepaymentFloorApiResult;
  assert.ok(result, "Missing API result from previous step");
  assert.strictEqual(result.status, 403);
  assert.ok(result.body && typeof result.body === "object" && result.body !== null);
  assert.strictEqual((result.body as { code: string }).code, "prepayment_ledger_floor");
});
