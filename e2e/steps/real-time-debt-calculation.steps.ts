import { Given, When, Then } from '@cucumber/cucumber';
import { chromium, Browser, Page } from 'playwright';
import assert from 'node:assert/strict';
import { getBrowser, setBrowser, getPage, setPage } from './shared-state';

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

Given('I navigate to the credits page', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not initialized');
  
  await page.goto('http://localhost:5000/zorrak');
  await page.waitForLoadState('networkidle');
  
  // Wait for credits page to load
  await page.waitForSelector('[data-testid="credits-page"]', { timeout: 5000 });
});

Given('I select the current month', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not initialized');
  
  // Get current month string
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  
  // Select current month from dropdown
  await page.click('[data-testid="select-month"]');
  
  // Wait for dropdown to open and select the month option by text
  await page.waitForSelector('[role="option"]', { timeout: 5000 });
  await page.locator(`[role="option"]:has-text("${currentMonthString}")`).click();
  
  // Wait for data to load
  await page.waitForTimeout(2000);
});

Then('I should see the debts for all members', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not initialized');
  
  // Wait for credits table to be visible
  await page.waitForSelector('[data-testid="credits-table"]', { timeout: 10000 });
  
  // Check that we have some credit rows
  const creditRows = await page.locator('[data-testid^="row-credit-"]').count();
  assert.ok(creditRows > 0);
});

Then('I find the debt amount for "Miren Urrutia"', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not initialized');
  
  // Find Miren Urrutia's row and extract the debt amount
  const mirenRow = page.locator('[data-testid^="row-credit-"]').filter({ hasText: 'Miren Urrutia' }).first();
  
  if (await mirenRow.count() > 0) {
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

When('I capture the consumption amount from the confirmation dialog', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not initialized');
  
  // Capture the consumption amount from the confirmation dialog
  const totalAmountText = await page.locator('[data-testid="total-amount"]').textContent();
  if (totalAmountText) {
    const amountMatch = totalAmountText.match(/([\d.]+)€/);
    if (amountMatch) {
      testState.consumptionAmount = parseFloat(amountMatch[1]);
    }
  }
});

When('I wait 3 seconds for debt calculation to complete', async function () {
  await new Promise(resolve => setTimeout(resolve, 3000));
});

Then('I should see that {string}\'s debt has increased by the consumption amount', async function (memberName: string) {
  const page = getPage();
  if (!page) throw new Error('Page not initialized');
  
  // Find the member's row again and extract the new debt amount
  const memberRow = page.locator('[data-testid^="row-credit-"]').filter({ hasText: memberName }).first();
  
  if (await memberRow.count() > 0) {
    const amountElement = memberRow.locator('[data-testid^="credit-amount-"]');
    const amountText = await amountElement.textContent();
    
    if (amountText) {
      const amountMatch = amountText.match(/([\d.]+)€/);
      if (amountMatch) {
        testState.finalDebt = parseFloat(amountMatch[1]);
      }
    }
  }
});

Then('the debt increase should match the consumption total', async function () {
  const debtIncrease = testState.finalDebt - testState.initialDebt;
  
  // Allow for small floating point differences
  assert.ok(Math.abs(debtIncrease - testState.consumptionAmount) < 0.01);
});
