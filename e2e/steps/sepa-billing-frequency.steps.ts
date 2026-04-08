import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";
import { clickSidebarNavLink } from "./sidebar-helpers";

When("I set SEPA mode to quarterly", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="select-sepa-mode"]');
  await page.getByRole("option", { name: /trimestral|hiruhilekoa/i }).click();
});

When("I set SEPA mode to on_demand", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="select-sepa-mode"]');
  await page.getByRole("option", { name: /Manual|Eskuz/i }).click();
});

When("I set SEPA mode to disabled", async function () {
  const page = getPage();
  assert.ok(page);
  await page.getByTestId("checkbox-payment-sepa").setChecked(false);
});

When("I set SEPA mode to monthly", async function () {
  const page = getPage();
  assert.ok(page);
  await page.getByTestId("checkbox-payment-sepa").setChecked(true);
  await page.click('[data-testid="select-sepa-mode"]');
  await page.getByRole("option", { name: /Mensual|Hilabeteka/i }).click();
});

When("I navigate to the SEPA export page", async function () {
  const page = getPage();
  assert.ok(page);
  await clickSidebarNavLink(page, "link-sepa");
  await page.waitForSelector('[data-testid="sepa-export-page"]', { timeout: 15000 });
});

When("I navigate to the SEPA export page by URL", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/sepa"), { waitUntil: "domcontentloaded" });
});

Then("I should see quarterly hints on the SEPA export step", async function () {
  const page = getPage();
  assert.ok(page);
  const trigger = page.locator('[data-testid="select-export-month"]');
  await trigger.waitFor({ state: "visible", timeout: 10000 });
  await trigger.click();
  const option = page.getByRole("option").first();
  const text = await option.textContent();
  assert.ok(text && /Q[1-4]/i.test(text), `Expected quarter label in option, got: ${text}`);
  await page.keyboard.press("Escape");
});

Then("I should see on-demand month range selectors on SEPA export", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector('[data-testid="select-sepa-from-month"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="select-sepa-to-month"]', { timeout: 10000 });
});

Then("I should not see the SEPA sidebar link", async function () {
  const page = getPage();
  assert.ok(page);
  const link = await page.$('[data-testid="link-sepa"]');
  assert.ok(!link, "SEPA sidebar link should be hidden when SEPA is disabled");
});

Then("I should see SEPA export disabled empty state", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector('[data-testid="sepa-export-disabled"]', { timeout: 10000 });
});
