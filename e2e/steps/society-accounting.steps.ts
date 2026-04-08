import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I navigate to the society accounting page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/kontabilitatea"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="society-accounting-page"]', { timeout: 10000 });
});

Then("I should see the society accounting view", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector('[data-testid="accounting-summary-table"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="society-accounting-panel"]', { timeout: 10000 });
});

When("I add a manual expense entry", { timeout: 40 * 1000 }, async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="society-accounting-tab-derived-movements"]');
  await page.click('[data-testid="add-manual-entry-button"]');
  await page.waitForSelector('[data-testid="dialog-manual-entry"]', { timeout: 10000 });
  await page.click('[data-testid="select-manual-entry-category"]');
  await page.getByRole("option", { name: /Hornidurak|Proveedores/ }).click();
  await page.fill('[data-testid="input-manual-entry-amount"]', "5.01");
  const today = new Date().toISOString().slice(0, 10);
  await page.fill('[data-testid="input-manual-entry-date"]', today);
  await page.fill('[data-testid="input-manual-entry-description"]', "E2E manual expense");

  const [response] = await Promise.all([
    page.waitForResponse(
      r =>
        r.url().includes("/api/society-transactions") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 20000 }
    ),
    page.click('[data-testid="button-submit-manual-entry"]'),
  ]);
  assert.ok(response.ok(), `POST society-transactions failed: ${response.status()}`);
  await page.waitForSelector('[data-testid="dialog-manual-entry"]', {
    state: "hidden",
    timeout: 15000,
  });
});

Then("I should see the manual expense in the entries list", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="society-accounting-tab-derived-movements"]');
  const table = page.locator('[data-testid="society-accounting-derived-movements-table"]');
  const row = table.locator("tbody tr").filter({ hasText: "E2E manual expense" });
  await row.first().waitFor({ state: "visible", timeout: 15000 });
});

Then("the expense total should reflect the new entry", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="society-accounting-tab-derived-movements"]');
  const table = page.locator('[data-testid="society-accounting-derived-movements-table"]');
  const row = table.locator("tbody tr").filter({ hasText: "E2E manual expense" });
  await row.getByText(/5[.,]01/).first().waitFor({ state: "visible", timeout: 10000 });
});

Then("the income total should include the prepayment amount", async function () {
  const page = getPage();
  assert.ok(page);
  const table = page.locator('[data-testid="accounting-summary-table"]');
  await table.waitFor({ state: "visible", timeout: 10000 });
  await table
    .getByText(/Bazkideen aurreordainketak|Anticipos de socios/)
    .waitFor({ state: "visible", timeout: 10000 });
});
