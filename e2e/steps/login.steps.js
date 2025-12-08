import { Given, When, Then, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

setDefaultTimeout(60 * 1000);

let browser;
let page;

BeforeAll(async () => {
  browser = await chromium.launch();
});

AfterAll(async () => {
  if (browser) {
    await browser.close();
  }
});

Given('the application is running', async function () {
  // Assumes `pnpm dev` is already running on localhost:5000
  // This step is a no-op placeholder.
});

When('I open the login page', async function () {
  page = await browser.newPage();
  await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });
});

Then('I should see the login form', async function () {
  assert.ok(page, 'Page was not initialized');
  // Check for email and password inputs by data-testid
  const emailInput = await page.$('[data-testid="input-email"]');
  const passwordInput = await page.$('[data-testid="input-password"]');
  assert.ok(emailInput, 'Email input not found');
  assert.ok(passwordInput, 'Password input not found');
});

When('I log in as a bazkide user', async function () {
  assert.ok(page, 'Page was not initialized');

  await page.fill('[data-testid="input-email"]', 'bazkidea@txokoa.eus');
  // Use the actual seeded password from the database
  await page.fill('[data-testid="input-password"]', 'demo');

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('[data-testid="button-login"]'),
  ]);
});

When('I try to log in as a bazkide user with a wrong password', async function () {
  assert.ok(page, 'Page was not initialized');

  await page.fill('[data-testid="input-email"]', 'bazkidea@txokoa.eus');
  await page.fill('[data-testid="input-password"]', 'wrong-password');

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('[data-testid="button-login"]'),
  ]);
});

Then('I should see the dashboard instead of the login form', async function () {
  assert.ok(page, 'Page was not initialized');

  // Wait for the login form to disappear after a successful SPA login
  await page.waitForSelector('[data-testid="input-email"]', { state: 'detached', timeout: 5000 });

  // Then wait for a known dashboard element to appear
  await page.waitForSelector('[data-testid="reservation-item-1"]', { timeout: 5000 });
});

Then('I should see a login error message and still see the login form', async function () {
  assert.ok(page, 'Page was not initialized');

  // Error banner should be visible with the invalid credentials message
  const errorText = await page.textContent('text=Kredentzi okerrak');
  assert.ok(errorText, 'Expected login error message was not found');

  // Login form should still be visible
  const emailInput = await page.$('[data-testid="input-email"]');
  const passwordInput = await page.$('[data-testid="input-password"]');
  assert.ok(emailInput, 'Login email input is not visible after failed login');
  assert.ok(passwordInput, 'Login password input is not visible after failed login');
});
