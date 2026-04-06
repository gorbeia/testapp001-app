import { When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I navigate to the refunds page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/transferentziak"), { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="bank-transfers-page"]', { timeout: 10000 });
  await page.click('[data-testid="button-issue-refund"]');
  await page.waitForSelector('[data-testid="dialog-issue-refund"]', { timeout: 10000 });
});

When("I issue a refund to Miren Urrutia", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="select-refund-user"]');
  await page.getByRole("option", { name: "Miren Urrutia" }).click();
  await page.fill('[data-testid="input-refund-amount"]', "5.00");
  await page.fill('[data-testid="input-refund-description"]', "E2E refund");
  await page.click('[data-testid="button-submit-refund"]');
  await page.waitForTimeout(1500);
});
