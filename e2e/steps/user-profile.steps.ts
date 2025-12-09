import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getPage } from './shared-state.js';

Given('I navigate to the profile page', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  
  await page.click('[data-testid="link-profile"]');
  await page.waitForLoadState('networkidle');
});

Then('I should see the profile page', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const heading = await page.locator('h1.text-2xl').textContent();
  assert.ok(heading?.includes('Profila'), 'Profile page heading not found');
});

Then('I should see my user information', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // Check for any of the expected user emails
  const emails = ['bazkidea@txokoa.eus', 'sotolaria@txokoa.eus', 'laguna@txokoa.eus'];
  const names = ['Miren Urrutia', 'Jon Agirre', 'Andoni Garcia'];
  
  let emailVisible = false;
  let nameVisible = false;
  
  for (const email of emails) {
    if (await page.locator(`text=${email}`).isVisible()) {
      emailVisible = true;
      break;
    }
  }
  
  for (const name of names) {
    if (await page.locator(`h2:has-text("${name}")`).isVisible()) {
      nameVisible = true;
      break;
    }
  }
  
  assert.ok(emailVisible, 'User email not visible');
  assert.ok(nameVisible, 'User name not visible');
});

Then('I should see the contact information section', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const contactInfo = await page.locator('text=Kontaktu informazioa').isVisible();
  const emailLabel = await page.locator('text=Posta elektronikoa').isVisible();
  assert.ok(contactInfo, 'Contact information section not visible');
  assert.ok(emailLabel, 'Email label not visible');
});

Then('I should see the edit button', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const editButton = await page.locator('button:has-text("Editatu")').isVisible();
  assert.ok(editButton, 'Edit button not visible');
});

When('I click the edit button', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.click('button:has-text("Editatu")');
});

Then('I should see the edit form', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const ibanInput = await page.locator('input#iban').isVisible();
  const saveButton = await page.locator('button:has-text("Gorde")').isVisible();
  const cancelButton = await page.locator('button:has-text("Utzi")').isVisible();
  assert.ok(ibanInput, 'IBAN input field not visible');
  assert.ok(saveButton, 'Save button not visible');
  assert.ok(cancelButton, 'Cancel button not visible');
});

Then('I should see the IBAN input field', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const ibanInput = await page.locator('input#iban').isVisible();
  assert.ok(ibanInput, 'IBAN input field not visible');
});

When('I fill in the IBAN field with {string}', async function (iban: string) {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.fill('input#iban', iban);
});

When('I click the save button', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.click('button:has-text("Gorde")');
});

Then('I should see the updated IBAN value', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // Wait a moment for the UI to update
  await page.waitForTimeout(1000);
  
  // Check for the updated IBAN value (1338) that was saved
  const updatedIban = await page.locator('text=ES91 2100 0418 4502 0005 1338').isVisible();
  
  assert.ok(updatedIban, 'Updated IBAN value not visible');
});

Then('I should not see the edit form', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  const ibanInput = await page.locator('input#iban').isVisible();
  const saveButton = await page.locator('button:has-text("Gorde")').isVisible();
  assert.ok(!ibanInput, 'IBAN input field should not be visible');
  assert.ok(!saveButton, 'Save button should not be visible');
});

When('I click the cancel button', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  await page.click('button:has-text("Utzi")');
});

Then('I should see the original IBAN value', async function () {
  const page = getPage();
  if (!page) throw new Error('Page not available');
  // For laguna user, the original IBAN is empty, so we check that the new IBAN is NOT visible
  const newIban = await page.locator('text=ES91 2100 0418 4502 0005 9999').isVisible();
  assert.ok(!newIban, 'New IBAN should not be visible after cancel');
});
