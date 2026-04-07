import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I disable bank transfer prepayment on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="card-payment-methods"]', { timeout: 10000 });
  await page.getByTestId("checkbox-payment-bank_transfer_prepayment").setChecked(false);
});

When("I enable bank transfer prepayment on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="card-payment-methods"]', { timeout: 10000 });
  await page.getByTestId("checkbox-payment-bank_transfer_prepayment").setChecked(true);
});

When("I navigate to the prepayments page by URL", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.goto(e2eUrl("/transferentziak"), { waitUntil: "domcontentloaded" });
});

Then("I should not see the prepayments sidebar link", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  const link = await page.$('[data-testid="link-transferentziak"]');
  assert.ok(!link, "Prepayments sidebar link should be hidden");
});

Then("I should see the prepayments sidebar link", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  const link = page.locator('[data-testid="link-transferentziak"]');
  await link.waitFor({ state: "visible", timeout: 10000 });
});

Then("I should see the prepayments disabled empty state", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="bank-transfers-prepayment-disabled"]', {
    timeout: 10000,
  });
});

Then("I should not see the propose transfer button on my movements", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="my-movements-page"]', { timeout: 10000 });
  const btn = page.locator('[data-testid="button-propose-transfer"]');
  assert.strictEqual(await btn.count(), 0, "Propose transfer button should not be present");
});

When("I enable cash manual payment on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="card-payment-methods"]', { timeout: 10000 });
  await page.getByTestId("checkbox-payment-cash_manual").setChecked(true);
});

When("I enable cash change machine payment on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="card-payment-methods"]', { timeout: 10000 });
  await page.getByTestId("checkbox-payment-cash_change_machine").setChecked(true);
});

When("I disable cash manual payment on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="card-payment-methods"]', { timeout: 10000 });
  await page.getByTestId("checkbox-payment-cash_manual").setChecked(false);
});

When("I disable cash change machine payment on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  await page.waitForSelector('[data-testid="card-payment-methods"]', { timeout: 10000 });
  await page.getByTestId("checkbox-payment-cash_change_machine").setChecked(false);
});

Then("cash manual payment should be enabled on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  const cb = page.getByTestId("checkbox-payment-cash_manual");
  assert.ok(await cb.isChecked(), "Cash manual should stay checked after reload");
});

Then("cash change machine payment should be enabled on the society page", async function () {
  const page = getPage();
  assert.ok(page, "Page not initialized");
  const cb = page.getByTestId("checkbox-payment-cash_change_machine");
  assert.ok(await cb.isChecked(), "Cash change machine should stay checked after reload");
});
