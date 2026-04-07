import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

Given("I navigate to the supplies page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.goto(e2eUrl("/hornidurak"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="page-stock-receipts"]', { state: "visible" });
});

When("I open the new supply receipt dialog", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click('[data-testid="button-new-stock-receipt"]');
  await page.waitForSelector('[data-testid="input-receipt-supplier"]', { state: "visible" });
});

When("I fill the receipt supplier with {string}", async function (supplier: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.fill('[data-testid="input-receipt-supplier"]', supplier);
});

When(
  "I fill the first receipt line with the first available product and quantity {string}",
  async function (quantity: string) {
    const page = getPage();
    if (!page) throw new Error("Page not available");
    await page.click('[data-testid="select-receipt-product-0"]');
    await page.waitForSelector("[cmdk-item]", { state: "visible" });
    const firstOption = page.locator("[cmdk-item]").first();
    await firstOption.click();
    await page.fill('[data-testid="input-receipt-qty-0"]', quantity);
  }
);

When("I save the supply receipt", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click('[data-testid="button-save-receipt"]');
  await page.waitForTimeout(2000);
});

Then("I should see {string} in the supplies table", async function (text: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  const table = page.locator('[data-testid="table-stock-receipts"]');
  const cell = table.getByText(text, { exact: false }).first();
  assert.ok(
    await cell.isVisible({ timeout: 10000 }),
    `Expected to see "${text}" in supplies table`
  );
});
