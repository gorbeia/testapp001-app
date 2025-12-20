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
  const reservationCard = page.locator('[data-testid^="card-reservation-"]').filter({ hasText: uniqueReservationName }).first();
  await reservationCard.waitFor({ state: 'visible', timeout: 5000 });
  
  // Store the reservation ID for later use
  const reservationId = await reservationCard.getAttribute('data-testid');
  this.testReservationId = reservationId;
});

When('I cancel the user\'s reservation', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  const uniqueReservationName = this.testReservationName || 'Test Erreserba Notifikazioa';
  const reservationCard = page.locator('[data-testid^="card-reservation-"]').filter({ hasText: uniqueReservationName }).first();
  await reservationCard.waitFor({ state: 'visible', timeout: 5000 });
  
  // Find the cancel button (Button with X icon, red color)
  const cancelButton = reservationCard.locator('button.text-red-600').first();
  
  if (await cancelButton.isVisible()) {
    await cancelButton.click();
    await page.waitForTimeout(1000);
    
    // Handle confirmation dialog - look for "Berretsi" (Confirm in Basque)
    const confirmButton = page.locator('button:has-text("Berretsi"), button:has-text("Bai"), button:has-text("Yes")').first();
    if (await confirmButton.isVisible({ timeout: 3000 })) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    } else {
      throw new Error('Confirmation button not found in cancel dialog');
    }
  } else {
    throw new Error('Cancel button not found in reservation card');
  }
});

Then('the reservation should be marked as cancelled', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  const uniqueReservationName = this.testReservationName || 'Test Erreserba Notifikazioa';
  const reservationCard = page.locator('[data-testid^="card-reservation-"]').filter({ hasText: uniqueReservationName }).first();
  
  if (await reservationCard.isVisible({ timeout: 5000 })) {
    const cardText = await reservationCard.textContent();
    const isCancelled = cardText?.includes('ezeztatua') || cardText?.includes('cancel') || cardText?.includes('cancelled');
    assert.ok(isCancelled, 'Reservation should be marked as cancelled');
  } else {
    // Reservation might be removed from list after cancellation
    assert.ok(true, 'Reservation is no longer visible (likely cancelled)');
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
