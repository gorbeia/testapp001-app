import { Given, When, Then, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser, Page } from 'playwright';
import assert from 'node:assert/strict';
import { getBrowser, setBrowser, getPage, setPage } from './shared-state';

setDefaultTimeout(60 * 1000);

let lastRandomUserEmail: string | undefined;

BeforeAll(async function () {
  const browserInstance: Browser = await chromium.launch({ 
    headless: process.env.E2E_HEADED === 'false',
    slowMo: process.env.E2E_HEADED === 'false' ? 100 : 0,
    devtools: process.env.E2E_HEADED === 'false', // Open dev tools
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  setBrowser(browserInstance);
});

AfterAll(async function () {
  const browserInstance = getBrowser();
  if (browserInstance) {
    await browserInstance.close();
  }
  const page = getPage();
  if (page) {
    await page.close().catch(() => {});
  }
});

Given('the application is running', async function () {
  // Assumes `pnpm dev` is already running on localhost:5000
  // This step is a no-op placeholder.
});

When('I open the login page', async function () {
  const browserInstance = getBrowser();
  if (!browserInstance) throw new Error('Browser not initialized');
  
  // Close existing page if any
  const existingPage = getPage();
  if (existingPage) {
    await existingPage.close().catch(() => {});
  }
  
  const pageInstance: Page = await browserInstance.newPage();
  setPage(pageInstance);
  await pageInstance.goto('http://localhost:5000/', { waitUntil: 'networkidle' });
});

Then('I should see the login form', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');
  // Check for email and password inputs by data-testid
  const emailInput = await page.$('[data-testid="input-email"]');
  const passwordInput = await page.$('[data-testid="input-password"]');
  assert.ok(emailInput, 'Email input not found');
  assert.ok(passwordInput, 'Password input not found');
});

When('I log in as a {word} user', async function (role: string) {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  const emailByRole: Record<string, string> = {
    bazkide: 'bazkidea@txokoa.eus',
    admin: 'admin@txokoa.eus',
    sotolaria: 'sotolaria@txokoa.eus',
    laguna: 'laguna@txokoa.eus',
  };

  const email = emailByRole[role];
  assert.ok(email, `Unknown demo user role: ${role}`);

  await page.fill('[data-testid="input-email"]', email);
  // Use the actual seeded password from the database
  await page.fill('[data-testid="input-password"]', 'demo');

  // Click login and wait for navigation
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('[data-testid="button-login"]'),
  ]);

  // Wait a moment for the app to store the token
  await page.waitForTimeout(1000);
  
  // Verify we're logged in by checking we're no longer on login page
  const currentUrl = page.url();
  assert.ok(!currentUrl.includes('/login'), 'Should be redirected from login page');
});

When('I try to log in as a bazkide user with a wrong password', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  await page.fill('[data-testid="input-email"]', 'bazkidea@txokoa.eus');
  await page.fill('[data-testid="input-password"]', 'wrong-password');

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('[data-testid="button-login"]'),
  ]);
});

Then('I should see the dashboard instead of the login form', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Wait for the login form to disappear after a successful SPA login
  await page.waitForSelector('[data-testid="input-email"]', { state: 'detached', timeout: 5000 });

  // Then wait for a known dashboard element to appear - the welcome header
  await page.waitForSelector('text=Ongi etorri', { timeout: 5000 });
});

Then('I should see a login error message and still see the login form', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Error banner should be visible with the invalid credentials message
  const errorText = await page.textContent('text=Kredentzial okerrak');
  assert.ok(errorText, 'Expected login error message was not found');

  // Login form should still be visible
  const emailInput = await page.$('[data-testid="input-email"]');
  const passwordInput = await page.$('[data-testid="input-password"]');
  assert.ok(emailInput, 'Login email input is not visible after failed login');
  assert.ok(passwordInput, 'Login password input is not visible after failed login');
});

When('I open the users management page', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');
  await page.goto('http://localhost:5000/erabiltzaileak', { waitUntil: 'networkidle' });

  // Ensure the page has rendered the users toolbar before proceeding
  await page.waitForSelector('[data-testid="button-new-user"]', { timeout: 5000 });
});

When('I create a new random user', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  const suffix = Date.now().toString();
  lastRandomUserEmail = `e2e-user-${suffix}@test.local`;
  const randomName = `E2E User ${suffix}`;

  // Open the "new user" dialog
  await page.click('[data-testid="button-new-user"]');

  // Fill basic fields
  await page.fill('[data-testid="input-user-name"]', randomName);
  await page.fill('[data-testid="input-user-email"]', lastRandomUserEmail);

  // Phone and IBAN are optional but we fill them for realism
  await page.fill('[data-testid="input-user-phone"]', '+34 600 000 000');
  await page.fill('[data-testid="input-user-iban"]', 'ES00 0000 0000 0000 0000 0000');

  // Save user
  await page.click('[data-testid="button-save-user"]');
});

Then('I should see a success notification for the new user', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Wait for toast with the success message used in UsersPage
  await page.waitForSelector('text=Erabiltzailea sortua / Usuario creado', { timeout: 5000 });

  // And ensure the newly created user is actually visible in the users table
  // We rely on the unique random email captured when the user was created
  if (lastRandomUserEmail) {
    await page.waitForSelector(`text=${lastRandomUserEmail}`, { timeout: 5000 });
  }
});
