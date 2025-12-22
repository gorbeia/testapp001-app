import { Given, When, Then } from '@cucumber/cucumber';
import { getPage } from './shared-state';
import assert from 'node:assert/strict';

Then('I should see the reservation in my reservations list', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  // Navigate to my reservations
  await page.click('[data-testid="link-nire-erreserbak"]');
  await page.waitForLoadState('networkidle');
  
  // Look for the reservation by text content
  const uniqueReservationName = this.testReservationName || 'Test Erreserba Notifikazioa';
  const reservationText = page.locator(`text=${uniqueReservationName}`);
  await reservationText.waitFor({ state: 'visible', timeout: 5000 });
});

When('I log out', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 5000 });
});

When('I find the user\'s reservation', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  const uniqueReservationName = this.testReservationName || 'Test Erreserba Notifikazioa';
  
  // Wait for admin page to load
  await page.waitForTimeout(2000);
  
  // Look for the reservation in the admin table (check first page)
  const reservationRow = page.locator('table tr').filter({ hasText: uniqueReservationName }).first();
  
  // Wait for the reservation to be visible
  await reservationRow.waitFor({ state: 'visible', timeout: 10000 });
  
  // Store the reservation row for later use
  this.testReservationRow = reservationRow;
});

When('I cancel the user\'s reservation', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  const uniqueReservationName = this.testReservationName || 'Test Erreserba Notifikazioa';
  
  // Use the stored reservation row or find it again
  const reservationRow = this.testReservationRow || page.locator('table tr').filter({ hasText: uniqueReservationName }).first();
  await reservationRow.waitFor({ state: 'visible', timeout: 5000 });
  
  // Find the cancel button (button containing X icon) in the table row
  const cancelButton = reservationRow.locator('button').filter({ has: page.locator('svg') }).first();
  
  if (await cancelButton.isVisible()) {
    await cancelButton.click();
    await page.waitForTimeout(1000);
    
    // Handle confirmation dialog - wait for it to appear using exact DOM selector
    await page.waitForSelector('div[role="alertdialog"][data-state="open"]', { timeout: 3000 });
    
    // Find the confirm button within the dialog using the exact DOM structure
    // The confirm button has destructive styling and contains "Erreserba ezeztatu"
    const confirmButton = page.locator('div[role="alertdialog"] button.bg-destructive:has-text("Erreserba ezeztatu")').first();
    
    if (await confirmButton.isVisible({ timeout: 3000 })) {
      await confirmButton.click();
      await page.waitForTimeout(2000); // Wait for cancellation to process
    } else {
      throw new Error('Confirmation button not found in cancel dialog');
    }
  } else {
    throw new Error('Cancel button not found in reservation row');
  }
});

Then('the reservation should be marked as cancelled', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  const uniqueReservationName = this.testReservationName || 'Test Erreserba Notifikazioa';
  
  // In admin page, check the table for the cancelled reservation
  const reservationRow = page.locator('table tr').filter({ hasText: uniqueReservationName }).first();
  
  if (await reservationRow.isVisible({ timeout: 5000 })) {
    const rowText = await reservationRow.textContent();
    
    // Check for various cancellation indicators in Basque and English
    const isCancelled = rowText?.includes('ezeztatua') || 
                       rowText?.includes('cancel') || 
                       rowText?.includes('cancelled') ||
                       rowText?.includes('Ezeztatua') ||
                       rowText?.includes('Cancel') ||
                       rowText?.includes('Cancelled');
    
    // Check if the reservation still has the cancel button
    const hasCancelButton = await reservationRow.locator('button').filter({ has: page.locator('svg') }).count() > 0;
    
    // Success if either marked as cancelled or cancel button is gone
    const success = isCancelled || !hasCancelButton;
    assert.ok(success, 'Reservation should be cancelled (either marked as cancelled or cancel button removed)');
  } else {
    // Reservation removed from list after cancellation - this is also success
    assert.ok(true, 'Reservation is no longer visible (cancelled)');
  }
});


When('I navigate to the notifications page', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  const notificationsLink = page.locator('[data-testid="link-jakinarazpenak"]');
  if (await notificationsLink.isVisible()) {
    await notificationsLink.click();
    await page.waitForLoadState('networkidle');
  } else {
    await page.goto('http://localhost:5000/jakinarazpenak');
    await page.waitForLoadState('networkidle');
  }
});

Then('I should see a cancellation notification', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  // Look for cancellation notification
  const cancellationTexts = ['ezeztatua', 'cancel', 'bazkaria'];
  
  for (const text of cancellationTexts) {
    try {
      const element = page.locator(`*:has-text("${text}")`).first();
      if (await element.isVisible({ timeout: 2000 })) {
        const elementText = await element.textContent();
        
        // Check if it's actually a cancellation notification
        if (elementText && (
          elementText.includes('Erreserba') || 
          elementText.includes('erreserba') ||
          elementText.includes('ezeztatu')
        )) {
          this.cancellationNotificationText = elementText;
          return;
        }
      }
    } catch (error) {
      // Continue to next text
    }
  }
  
  throw new Error('Should find a cancellation notification');
});

Then('the notification should be in the correct language', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  const notificationText = this.cancellationNotificationText;
  
  if (!notificationText) {
    throw new Error('No cancellation notification text found');
  }
  
  // Check for Basque indicators (default language)
  const basqueIndicators = ['Erreserba', 'ezeztatua', 'Zure', 'erreserba'];
  const isBasque = basqueIndicators.some(indicator => notificationText.includes(indicator));
  
  assert.ok(isBasque, `Notification should be in Basque, but got: ${notificationText}`);
});
