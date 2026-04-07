import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I open the stock adjustment dialog for the current product", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const context = this as { currentProductName?: string };
  const name = context.currentProductName;
  assert.ok(name, "Expected currentProductName from product creation steps");

  const productRow = page.locator(`tr:has-text("${name}")`).first();
  const menuButton = productRow.locator('[data-testid^="button-product-menu-"]').first();
  await menuButton.click();
  await page.getByRole("menuitem", { name: /Stock doitu|Ajustar stock/i }).click();
  await page.waitForSelector('[data-testid="dialog-adjust-stock"]', { state: "visible" });
});

When("I fill the adjustment quantity with {string}", async function (quantity: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.fill('[data-testid="input-adjust-quantity"]', quantity);
});

When("I fill the adjustment reason with {string}", async function (reason: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.fill('[data-testid="input-adjust-reason"]', reason);
});

When("I apply the stock adjustment", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click('[data-testid="button-apply-adjust"]');
  await page.waitForTimeout(1500);
});

Given("I navigate to the stock changes page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.goto(e2eUrl("/stock-aldaketak"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="page-stock-changes"]', { state: "visible" });
});

Then("I should see a stock log row containing {string}", async function (text: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.waitForTimeout(500);
  const row = page.locator('[data-testid^="row-stock-movement-"]').filter({ hasText: text }).first();
  assert.ok(await row.isVisible(), `Expected a stock log row containing "${text}"`);
});
