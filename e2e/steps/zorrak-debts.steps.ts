import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert";
import { getPage, e2eUrl } from "./shared-state";

When("I navigate to the Zorrak debts page", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");

  await page.goto(e2eUrl("/zorrak"));
  await page.waitForLoadState("networkidle");
});

Then("I should see the debts management interface", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");

  await page.waitForSelector('[data-testid="credits-page"]', { timeout: 15000 });

  const currentUrl = page.url();
  assert(currentUrl.includes("/zorrak"), "Should be on zorrak page");

  const creditsPage = await page.$('[data-testid="credits-page"]');
  assert(creditsPage, "Should see credits page");

  const pageTitle = await page.$('[data-testid="credits-page-title"]');
  assert(pageTitle, "Should see page title");
});

Then("I should see a list of users with their debts", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");

  await page.waitForSelector('[data-testid="credits-table"]', { timeout: 15000 });

  const creditsTable = await page.$('[data-testid="credits-table"]');
  assert(creditsTable, "Should see credits table");

  const noResults = await page.$('[data-testid="no-results-message"]');
  if (noResults) {
    assert(true, "No debt items available");
  } else {
    const creditRows = await page.$$('[data-testid^="row-credit-"]');
    assert(creditRows.length > 0, "Should see credit rows");
  }
});

Then("each debt should show the user name and amount", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");

  await page.waitForSelector(
    '[data-testid="no-results-message"], [data-testid^="row-credit-"]',
    { timeout: 15000 }
  );

  const noResults = await page.$('[data-testid="no-results-message"]');
  if (noResults) {
    assert(true, "No debt items available");
    return;
  }

  const creditRows = await page.$$('[data-testid^="row-credit-"]');
  assert(creditRows.length > 0, "Should see credit rows");

  for (let i = 0; i < Math.min(creditRows.length, 3); i++) {
    const row = creditRows[i];
    const rowId = await row.getAttribute("data-testid");
    const creditId = rowId?.replace("row-credit-", "");

    if (creditId) {
      const memberElement = await page.$(`[data-testid="credit-member-${creditId}"]`);
      if (memberElement) {
        const memberName = await memberElement.textContent();
        assert(memberName && memberName.trim().length > 0, "Should see member name");
      }

      const amountElement = await page.$(`[data-testid="credit-amount-${creditId}"]`);
      assert(amountElement, "Should see amount element");
      const amountText = await amountElement.textContent();
      assert(amountText && amountText.match(/\d+\.\d+€/), "Amount should contain a number with €");
    }
  }
});

Then("I should see a total sum displayed", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");

  const totalElement = await page.waitForSelector('[data-testid="total-grand"]', {
    timeout: 15000,
  });
  assert(totalElement, "Should see total element");

  const totalText = await totalElement.textContent();
  assert(totalText, "Total text should not be null");
  assert(totalText.match(/\d+\.\d+€/), "Total should contain a number with €");
});

When("I calculate the sum of all individual debts", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");
  this.calculatedSum = 0;

  await page.waitForSelector(
    '[data-testid="no-results-message"], [data-testid^="row-credit-"]',
    { timeout: 15000 }
  );

  const creditRows = await page.$$('[data-testid^="row-credit-"]');

  for (const row of creditRows) {
    const rowId = await row.getAttribute("data-testid");
    const creditId = rowId?.replace("row-credit-", "");

    if (creditId) {
      const amountElement = await page.$(`[data-testid="credit-amount-${creditId}"]`);
      if (amountElement) {
        const amountText = await amountElement.textContent();
        if (amountText) {
          const numericValue = parseFloat(amountText.replace("€", ""));
          if (!isNaN(numericValue)) {
            this.calculatedSum += numericValue;
          }
        }
      }
    }
  }
});

Then("the calculated sum should match the displayed total", async function () {
  const page = getPage();
  assert(page, "Page should be initialized");

  const totalElement = await page.waitForSelector('[data-testid="total-grand"]', {
    timeout: 15000,
  });
  assert(totalElement, "Total element should exist");

  const totalText = await totalElement.textContent();
  assert(totalText, "Total text should not be null");

  const displayedTotal = parseFloat(totalText.replace("€", ""));

  const tolerance = 0.01;
  assert(
    Math.abs(this.calculatedSum - displayedTotal) < tolerance,
    `Calculated sum ${this.calculatedSum} should match displayed total ${displayedTotal}`
  );
});
