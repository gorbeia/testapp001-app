import { When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I navigate to the bank transfers page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/transferentziak"), { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="bank-transfers-page"]', { timeout: 10000 });
});

When("I create a pending bank transfer for Miren Urrutia", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="button-new-transfer"]');
  await page.waitForSelector('[data-testid="dialog-new-transfer"]');
  await page.click('[data-testid="select-transfer-user"]');
  await page.getByRole("option", { name: "Miren Urrutia" }).click();
  await page.fill('[data-testid="input-transfer-amount"]', "12.34");
  const today = new Date().toISOString().slice(0, 10);
  await page.fill('[data-testid="input-transfer-date"]', today);
  await page.fill('[data-testid="input-transfer-reference"]', "E2E-REF");
  await page.click('[data-testid="button-save-transfer"]');
  await page.waitForTimeout(1500);
});

When("I validate the first pending bank transfer", async function () {
  const page = getPage();
  assert.ok(page);
  const btn = await page.$('[data-testid^="button-validate-"]');
  assert.ok(btn, "Expected a validate button for pending transfer");
  await btn.click();
  await page.waitForTimeout(1500);
});
