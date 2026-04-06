import { Given, When, Then } from "@cucumber/cucumber";
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

  await page.goto(e2eUrl("/zorrak"));
  await page.waitForLoadState("networkidle");

  // Wait for credits page to load
  await page.waitForSelector('[data-testid="credits-page"]', { timeout: 5000 });
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

  // Wait for data to load using waitForLoadState instead of timeout
  await page.waitForLoadState("networkidle");
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

  if (await mirenRow.isVisible()) {
    const amountElement = mirenRow.locator('[data-testid^="credit-amount-"]');
    const amountText = await amountElement.textContent();

    if (amountText) {
      // Extract numeric value from "XX.XX€"
      const amountMatch = amountText.match(/([\d.]+)€/);
      if (amountMatch) {
        testState.initialDebt = parseFloat(amountMatch[1]);
      }
    }
  } else {
    testState.initialDebt = 0;
  }
});

When("I capture the consumption amount from the confirmation dialog", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  // Capture the consumption amount from the confirmation dialog
  const totalAmountText = await page.locator('[data-testid="total-amount"]').textContent();
  if (totalAmountText) {
    const amountMatch = totalAmountText.match(/([\d.]+)€/);
    if (amountMatch) {
      testState.consumptionAmount = parseFloat(amountMatch[1]);
    }
  }
});

When("I wait 3 seconds for debt calculation to complete", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not initialized");

  // Wait for debt calculation to complete (more efficient than fixed timeout)
  await page.waitForTimeout(2000);
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

  // Allow for small floating point differences
  assert.ok(Math.abs(debtIncrease - testState.consumptionAmount) < 0.01);
});
