import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I log out from the sidebar", async function () {
  const page = getPage();
  assert.ok(page);
  const logout = page.locator('[data-testid="button-logout"]');
  if (!(await logout.isVisible())) {
    await page.click('[data-testid="button-sidebar-toggle"]');
    await logout.waitFor({ state: "visible", timeout: 5000 });
  }
  await logout.click();
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 10000 });
});

When("I navigate to my account movements page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/nire-mugimenduak"), { waitUntil: "domcontentloaded" });
});

Then("I should see the my movements page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector('[data-testid="my-movements-page"]', { timeout: 10000 });
});

When("I navigate to admin account movements page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/mugimenduak"), { waitUntil: "domcontentloaded" });
});

Then("I should see the admin movements page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector('[data-testid="admin-movements-page"]', { timeout: 10000 });
});

Then("I should see a prepayment line on my movements", async function () {
  const page = getPage();
  assert.ok(page);
  const cell = page
    .locator('[data-testid^="movement-type-"]')
    .filter({ hasText: /Aurreordainketa|Anticipo/ });
  await cell.first().waitFor({ state: "visible", timeout: 10000 });
});

Then("I should see a refund line on my movements", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector("text=Itzulketa", { timeout: 10000 });
});
