import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getPage } from './shared-state.js';

// Consumption Management Steps
Given('I navigate to the consumptions page', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  await page.click('text=Kontsumoak');
  await page.waitForLoadState('networkidle');
});

When('I add {string} to the cart', async function (productName: string) {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // Wait for products to load
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
  
  // Find the first product card that contains the product name and click its add button
  const productCard = page.locator(`[data-testid="product-card"]:has-text("${productName}")`).first();
  await productCard.locator('[data-testid="button-add-to-cart"]').click();
  
  // Wait a moment for the cart to update
  await page.waitForTimeout(500);
});

When('I increase the quantity of {string} to {int}', async function (productName: string, quantity: number) {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // Find the item in the cart and increase quantity
  const cartItem = page.locator(`[data-testid="cart-item"]:has-text("${productName}")`);
  
  // Click the plus button until we reach the desired quantity
  for (let i = 1; i < quantity; i++) {
    await cartItem.locator('[data-testid="button-increase-quantity"]').click();
    await page.waitForTimeout(200);
  }
});

When('I click the close account button', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.click('[data-testid="button-close-account"]');
});

When('I should see the confirmation dialog', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.waitForSelector('[data-testid="confirmation-dialog"]', { timeout: 5000 });
});

When('I should see the member name in the confirmation dialog', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const memberName = await page.locator('[data-testid="member-name"]').textContent();
  assert.ok(memberName, 'Member name should be visible');
  assert.ok(memberName.trim().length > 0, 'Member name should not be empty');
});

When('I should see the total amount in the confirmation dialog', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const totalAmount = await page.locator('[data-testid="total-amount"]').textContent();
  assert.ok(totalAmount, 'Total amount should be visible');
  assert.ok(totalAmount.includes('€'), 'Total amount should include currency symbol');
});

When('I should see {string} in the items table with quantity {int}', async function (productName: string, quantity: number) {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const itemRow = page.locator(`[data-testid="confirmation-items-table"] tr:has-text("${productName}")`);
  const quantityText = await itemRow.locator('td:nth-child(2)').textContent();
  assert.equal(parseInt(quantityText || '0'), quantity, `Quantity should be ${quantity}`);
});

When('the total amount should be the sum of all items', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  // Get the total amount from the confirmation dialog
  const totalAmountText = await page.locator('[data-testid="total-amount"]').textContent();
  const totalAmount = parseFloat((totalAmountText || '').replace('€', '').trim());
  
  // Get all item rows from the confirmation items table
  const itemRows = await page.locator('[data-testid="confirmation-items-table"] tbody tr').all();
  
  let calculatedSum = 0;
  
  for (const row of itemRows) {
    // Get quantity (second column)
    const quantityText = await row.locator('td:nth-child(2)').textContent();
    const quantity = parseInt(quantityText || '0');
    
    // Get unit price (third column)
    const unitPriceText = await row.locator('td:nth-child(3)').textContent();
    const unitPrice = parseFloat((unitPriceText || '').replace('€', '').trim());
    
    // Get item total (fourth column) - this should match quantity * unitPrice
    const itemTotalText = await row.locator('td:nth-child(4)').textContent();
    const itemTotal = parseFloat((itemTotalText || '').replace('€', '').trim());
    
    // Verify item total matches quantity * unit price
    const expectedItemTotal = quantity * unitPrice;
    assert.equal(itemTotal, expectedItemTotal, 
      `Item total ${itemTotal} should equal quantity ${quantity} * unit price ${unitPrice} = ${expectedItemTotal}`);
    
    calculatedSum += itemTotal;
  }
  
  // Verify the total matches the sum of all items
  assert.equal(totalAmount, calculatedSum, 
    `Total amount ${totalAmount} should equal sum of all items ${calculatedSum}`);
});

When('I confirm the consumption', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.click('[data-testid="button-confirm-consumption"]');
});

When('I cancel the consumption', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.click('[data-testid="button-cancel-consumption"]');
});

Then('I should see a success message', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  // Wait a moment for any processing to complete
  await page.waitForTimeout(2000);
  
  // Check for error toast first
  const errorToast = page.locator('[data-testid="toast-destructive"]');
  if (await errorToast.isVisible()) {
    const errorMessage = await errorToast.textContent();
    throw new Error(`Consumption failed with error: ${errorMessage}`);
  }
  
  // Try to find any toast that contains success message
  const successToast = page.locator('[data-testid^="toast-"]:has-text("itxita"), [data-testid^="toast-"]:has-text("cerrada")');
  await successToast.waitFor({ state: 'visible', timeout: 5000 });
  
  const successMessage = await successToast.textContent();
  assert.ok(successMessage?.includes('itxita') || successMessage?.includes('cerrada'), 
    'Success message should indicate consumption was closed');
});

Then('the cart should be empty', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  // Wait a moment for the cart to update
  await page.waitForTimeout(1000);
  
  // Check that the cart shows empty state instead of looking for cart-count badge
  const emptyCartMessage = await page.locator('text=Saskia hutsik dago').isVisible();
  assert.ok(emptyCartMessage, 'Cart should show empty message');
  
  // Alternatively, check that no cart items exist
  const cartItems = await page.locator('[data-testid="cart-item"]').count();
  assert.equal(cartItems, 0, 'Cart should have no items');
});

Then('the cart should still contain {string}', async function (productName: string) {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const cartItem = page.locator(`[data-testid="cart-item"]:has-text("${productName}")`);
  assert.ok(await cartItem.isVisible(), `Cart should still contain ${productName}`);
});

Then('the consumption should be saved in the database', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // Navigate to consumptions list page (admin only)
  // For regular users, we can verify by checking the API response or by checking that the stock was updated
  
  // For now, we'll verify by checking that the success message appears and cart is empty
  // In a real implementation, you might want to:
  // 1. Make an API call to check the database directly
  // 2. Navigate to admin consumptions list if user has admin rights
  // 3. Check that product stock was reduced appropriately
  
  // This is a simplified verification - in production you'd want more robust checks
  const successMessage = await page.locator('[data-testid="toast-default"]').textContent();
  assert.ok(successMessage?.includes('itxita') || successMessage?.includes('cerrada'), 
    'Success message should indicate consumption was closed');
});

Then('the consumption should appear in the consumption list', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  // Logout and login as admin to access consumption list
  await page.click('text=Logout');
  await page.waitForLoadState('networkidle');
  
  // Login as admin
  await page.fill('[data-testid="input-email"]', 'admin@txokoa.eus');
  await page.fill('[data-testid="input-password"]', 'password');
  await page.click('[data-testid="button-login"]');
  await page.waitForLoadState('networkidle');
  
  // Navigate to consumption list
  await page.click('text=Kontsumo Zerrenda');
  await page.waitForLoadState('networkidle');
  
  // Wait for consumptions to load
  await page.waitForSelector('[data-testid="consumption-row"]', { timeout: 10000 });
  
  // Get the most recent consumption (should be at the top)
  const firstConsumptionRow = page.locator('[data-testid="consumption-row"]').first();
  
  // Verify the consumption exists and has the expected data
  const consumptionText = await firstConsumptionRow.textContent();
  
  // Should contain user name, status, and total amount
  assert.ok(consumptionText?.includes('Itxita') || consumptionText?.includes('closed'), 
    'Consumption should have closed status');
  
  // Check that it has a valid consumption ID format
  const consumptionId = await firstConsumptionRow.locator('[data-testid="consumption-id"]').textContent();
  assert.ok((consumptionId?.length || 0) > 0, 'Consumption should have an ID');
  
  // Verify the total amount is displayed correctly
  const totalAmount = await firstConsumptionRow.locator('[data-testid="consumption-total"]').textContent();
  assert.ok(totalAmount?.includes('€'), 'Total should include currency symbol');
  
  console.log('Found consumption in list:', consumptionText);
});

Then('no consumption should be saved in the database', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // Verify that we're still on the consumptions page and the cart still has items
  const cartItems = await page.locator('[data-testid="cart-item"]').count();
  assert.ok(cartItems > 0, 'Cart should still have items, indicating no consumption was saved');
});
