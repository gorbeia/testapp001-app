import { Given, When, Then, Before } from "@cucumber/cucumber";
import type { Page } from "playwright";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

interface TestState {
  initialDebt: number;
  finalDebt: number;
  consumptionAmount: number;
}

const testState: TestState = {
  initialDebt: 0,
  finalDebt: 0,
  consumptionAmount: 0,
};

/** Reset shared numbers each scenario — module-level state must not leak between features. */
Before(function () {
  testState.initialDebt = 0;
  testState.finalDebt = 0;
  testState.consumptionAmount = 0;
});

/** YYYY-MM — same label as `credit.month` in the credits table */
function currentMonthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

/** One row per member per month; avoid `.first()` across all months */
function creditRowForMemberInCurrentMonth(page: Page, memberName: string) {
  const month = currentMonthLabel();
  return page
    .locator('[data-testid^="row-credit-"]')
    .filter({ hasText: month })
    .filter({ hasText: memberName })
    .first();
}

Given("I navigate to the credits page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  await page.goto(e2eUrl("/zorrak"), { waitUntil: "domcontentloaded" });

  // Wait for credits page to load
  await page.waitForSelector('[data-testid="credits-page"]', { timeout: 10000 });
});

Given("I select the current month", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  // Get current month string
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;

  // Select current month from dropdown
  await page.click('[data-testid="select-month"]');
  await page.waitForSelector('[role="option"]', { timeout: 5000 });
  await page.locator(`[role="option"]:has-text("${currentMonthString}")`).click();

  await page.waitForTimeout(1000);
});

Then("I should see the debts for all members", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  // Wait for credits table to be visible
  await page.waitForSelector('[data-testid="credits-table"]', { timeout: 10000 });

  // Check that we have some credit rows
  const creditRows = await page.locator('[data-testid^="row-credit-"]').count();
  assert.ok(creditRows > 0);
});

Then('I find the debt amount for "Miren Urrutia"', async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  const mirenRow = creditRowForMemberInCurrentMonth(page, "Miren Urrutia");
  await mirenRow.waitFor({ state: "visible", timeout: 15_000 });

  const amountElement = mirenRow.locator('[data-testid^="credit-amount-"]');
  const amountText = await amountElement.textContent();
  assert.ok(amountText?.trim(), "Expected credit amount cell for Miren");
  const amountTextNonNull = amountText as string;

  const amountMatch = amountTextNonNull.match(/([\d.]+)€/);
  assert.ok(amountMatch, `Could not parse debt from ${JSON.stringify(amountTextNonNull)}`);
  testState.initialDebt = parseFloat(amountMatch[1]);
  assert.ok(Number.isFinite(testState.initialDebt), `Invalid initial debt: ${amountTextNonNull}`);
});

When("I capture the consumption amount from the confirmation dialog", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  const totalAmountText = await page.locator('[data-testid="total-amount"]').textContent();
  assert.ok(totalAmountText?.trim(), "Confirmation dialog total should be visible");
  const totalAmountTextNonNull = totalAmountText as string;
  const amountMatch = totalAmountTextNonNull.match(/([\d.]+)€/);
  assert.ok(amountMatch, `Could not parse total from ${JSON.stringify(totalAmountTextNonNull)}`);
  testState.consumptionAmount = parseFloat(amountMatch[1]);
  assert.ok(
    testState.consumptionAmount > 0.01,
    `Expected positive consumption total, got ${testState.consumptionAmount}`
  );
});

When("I allow time for debt totals to update", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");
  await page.waitForTimeout(1500);
});

Then(
  "I should see that {string}'s debt has increased by the consumption amount",
  async function (memberName: string) {
    const page = getPage();
    if (!page) throw new Error("Page not initialized");

    const memberRow = creditRowForMemberInCurrentMonth(page, memberName);

    assert.ok(
      await memberRow.isVisible(),
      `Expected a credit row for ${memberName} in the current month`
    );

    const amountElement = memberRow.locator('[data-testid^="credit-amount-"]');
    const amountText = await amountElement.textContent();

    if (amountText) {
      const amountMatch = amountText.match(/([\d.]+)€/);
      if (amountMatch) {
        testState.finalDebt = parseFloat(amountMatch[1]);
      }
    }

    if (testState.consumptionAmount > 0.01) {
      assert.ok(
        testState.finalDebt > testState.initialDebt + 0.005,
        `Expected ${memberName}'s debt to increase after consumption (before ${testState.initialDebt}€, after ${testState.finalDebt}€; confirmation dialog total was ${testState.consumptionAmount}€)`
      );
    }
  }
);

Then("the debt increase should match the consumption total", async function () {
  const debtIncrease = testState.finalDebt - testState.initialDebt;

  // One cent tolerance: UI uses toFixed(2); backend may aggregate decimals slightly differently.
  const delta = Math.abs(debtIncrease - testState.consumptionAmount);
  assert.ok(
    delta < 0.02,
    `Debt increase ${debtIncrease.toFixed(2)}€ should match dialog total ${testState.consumptionAmount.toFixed(2)}€ (Δ ${delta.toFixed(4)})`
  );
});
