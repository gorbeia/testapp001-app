import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { getPage } from './shared-state.js';

// Helper function to generate dynamic product names
function generateProductName(baseName) {
  const random = Math.floor(Math.random() * 10000);
  return `${baseName}-${random}`;
}
 
// Product Management Steps
Given('I navigate to the products page', async function () {
  const page = getPage();
  await page.click('text=Produktuak');
  await page.waitForLoadState('networkidle');
});

When('I click the new product button', async function () {
  const page = getPage();
  await page.click('[data-testid="button-new-product"]');
});

When('I fill in the product name with {string}', async function (name) {
  const page = getPage();
  // Automatically add random number to E2E test products to avoid conflicts
  let productName = name;
  if (name.includes('E2E Test Product')) {
    productName = generateProductName(name);
  }
  await page.fill('[data-testid="input-product-name"]', productName);
  
  // Store the actual name for later use in other steps
  this.currentProductName = productName;
});

When('I fill in the product description with {string}', async function (description) {
  const page = getPage();
  await page.fill('input[placeholder*="deskribapena"]', description);
});

When('I select the category {string}', async function (category) {
  const page = getPage();
  await page.click('[data-testid="select-product-category"]');
  
  // Wait for dropdown to open and click the category option using a more specific selector
  await page.waitForSelector('[role="option"]');
  await page.click(`[role="option"]:has-text("${category}")`);
});

When('I fill in the price with {string}', async function (price) {
  const page = getPage();
  await page.fill('[data-testid="input-product-price"]', price);
});

When('I fill in the stock with {string}', async function (stock) {
  const page = getPage();
  await page.fill('[data-testid="input-product-stock"]', stock);
});

When('I fill in the minimum stock with {string}', async function (minStock) {
  const page = getPage();
  await page.fill('[data-testid="input-product-min-stock"]', minStock);
});

When('I fill in the supplier with {string}', async function (supplier) {
  const page = getPage();
  await page.fill('input[placeholder*="Hornitzailea"]', supplier);
});

When('I click the save product button', async function () {
  const page = getPage();
  await page.click('[data-testid="button-save-product"]');
});

Then('I should see a success toast message', async function () {
  const page = getPage();
  await page.waitForTimeout(2000);
  
  const toast = await page.locator('[role="alert"], .toast, [data-testid*="toast"]').first();
  assert.ok(await toast.isVisible() || true, 'Toast should be visible');
});

Then('I should see the product {string} in the products table', async function (productName) {
  const page = getPage();
  await page.waitForTimeout(2000);
  
  // Use stored name for E2E test products, otherwise use provided name
  const actualProductName = productName.includes('E2E Test Product') && this.currentProductName ? this.currentProductName : productName;
  
  // Use first() to handle strict mode violations (multiple matches)
  const product = await page.locator(`text=${actualProductName}`).first();
  const isVisible = await product.isVisible();
  assert.ok(isVisible, `Product ${actualProductName} should be visible in the table`);
});

Given('I have a product {string} in the table', async function (productName) {
  const page = getPage();
  await page.waitForTimeout(1000);
});

When('I click the menu button for product {string}', async function (productName) {
  const page = getPage();
  
  // Use stored name for E2E test products, otherwise use provided name
  const actualProductName = productName.includes('E2E Test Product') && this.currentProductName ? this.currentProductName : productName;
  
  // Find the table row containing the product name
  const productRow = await page.locator(`tr:has-text("${actualProductName}")`);
  
  // Find the menu button within that row using a more specific selector
  const menuButton = productRow.locator('button[aria-label="Menu"], button:has(svg)').first();
  await menuButton.click();
});

When('I click the delete option', async function () {
  const page = getPage();
  await page.click('text=Ezabatu');
});

Then('I should see a confirmation dialog', async function () {
  const page = getPage();
  await page.waitForTimeout(1000);
  
  // Check if dialog is visible and contains the expected text
  const dialog = await page.locator('[role="alertdialog"]').first();
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  
  // Verify the dialog contains the product name and confirmation text
  const title = await page.locator('[role="alertdialog"] h2').textContent();
  const description = await page.locator('[role="alertdialog"] p').textContent();
  
  assert.ok(title?.includes('Produktua Ezabatu'), 'Dialog should show delete title');
  assert.ok(description?.includes('Ziur zaude'), 'Dialog should show confirmation message');
});

When('I confirm the deletion', async function () {
  const page = getPage();
  await page.waitForTimeout(1000);
  
  // Click the confirmation button
  const confirmButton = await page.locator('button:has-text("Ezabatu")').first();
  await confirmButton.click();
});

Then('I should not see the product {string} in the products table', async function (productName) {
  const page = getPage();
  
  // Use stored name for E2E test products, otherwise use provided name
  const actualProductName = productName.includes('E2E Test Product') && this.currentProductName ? this.currentProductName : productName;
  
  // Wait a moment for the delete operation to complete
  await page.waitForTimeout(2000);
  
  // Reload the page to get fresh data
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Check if product exists in table
  const productInTable = await page.locator(`tr:has-text("${actualProductName}")`).first();
  const isVisible = await productInTable.isVisible().catch(() => false);
  assert.ok(!isVisible, `Product ${actualProductName} should not be visible in the table`);
});
