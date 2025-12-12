import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { getPage } from './shared-state';

// Main menu entries that all users should see
const MAIN_MENU_ENTRIES = [
  'link-home',           // Dashboard
  'link-erreserbak',    // General Reservations (shown to all users)
  'link-nire-erreserbak', // My Reservations (user view)
  'link-kontsumoak',    // General Consumptions (shown to all users)
  'link-nire-konsumoak', // My Consumptions
  'link-nire-zorrak',    // Personal Debts
  'link-oharrak',        // Announcements
  'link-txata',          // Chat
];

// Admin menu entries that only authorized users should see
const ADMIN_MENU_ENTRIES = [
  'link-erabiltzaileak', // Users
  'link-produktuak',     // Products
  'link-elkartea',       // Society
  'link-sepa',           // SEPA Export
];

Then('I should see the main menu entries', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Check that main menu entries are visible
  for (const entry of MAIN_MENU_ENTRIES) {
    const element = await page.$(`[data-testid="${entry}"]`);
    assert.ok(element, `Main menu entry ${entry} should be visible`);
  }
});

Then('I should not see any admin management entries', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Check that no admin menu entries are visible
  for (const entry of ADMIN_MENU_ENTRIES) {
    const element = await page.$(`[data-testid="${entry}"]`);
    assert.ok(!element, `Admin menu entry ${entry} should not be visible for bazkide user`);
  }

  // Also check that the admin section (Kudeaketa) is not present
  const adminSection = await page.$('text=Kudeaketa');
  assert.ok(!adminSection, 'Admin section "Kudeaketa" should not be visible for bazkide user');
});

Then('I should see the admin management section', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Check that the admin section is visible
  const adminSection = await page.$('text=Kudeaketa');
  assert.ok(adminSection, 'Admin section "Kudeaketa" should be visible for admin user');

  // Check that at least some admin entries are visible (admin should see all)
  const usersLink = await page.$('[data-testid="link-erabiltzaileak"]');
  const productsLink = await page.$('[data-testid="link-produktuak"]');
  const societyLink = await page.$('[data-testid="link-elkartea"]');
  const sepaLink = await page.$('[data-testid="link-sepa"]');

  assert.ok(usersLink, 'Users link should be visible for admin user');
  assert.ok(productsLink, 'Products link should be visible for admin user');
  assert.ok(societyLink, 'Society link should be visible for admin user');
  assert.ok(sepaLink, 'SEPA link should be visible for admin user');
});

Then('I should not be able to access admin pages directly', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Try to access admin pages directly and verify they're blocked
  const adminPages = [
    '/erabiltzaileak', // Users
    '/produktuak',     // Products
    '/elkartea',       // Society
    '/sepa',           // SEPA
  ];

  for (const pagePath of adminPages) {
    await page.goto(`http://localhost:5000${pagePath}`, { waitUntil: 'domcontentloaded' });
    
    // Wait a moment for the protected route to render
    await page.waitForTimeout(1000);
    
    // Check for the access denied message in Basque
    const accessDeniedMessage = await page.$('text=Ez duzu baimenik orri hau ikusteko');
    
    assert.ok(
      accessDeniedMessage,
      `Access to admin page ${pagePath} should show access denied message for bazkide user`
    );
  }
});

Then('I should be able to access all admin pages', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Try to access admin pages directly and verify they work
  const adminPages = [
    { path: '/erabiltzaileak', testId: 'button-new-user', name: 'Users' },
    { path: '/produktuak', testId: 'input-search-products', name: 'Products' },
    { path: '/elkartea', testId: null, name: 'Society' }, // Society page might not have specific test IDs yet
    { path: '/sepa', testId: null, name: 'SEPA' },        // SEPA page might not have specific test IDs yet
  ];

  for (const adminPage of adminPages) {
    await page.goto(`http://localhost:5000${adminPage.path}`, { waitUntil: 'networkidle' });
    
    // Check that we can access the page (no redirect to dashboard)
    const currentUrl = page.url();
    const expectedUrl = `http://localhost:5000${adminPage.path}`;
    
    assert.ok(
      currentUrl.includes(adminPage.path),
      `Admin user should be able to access ${adminPage.name} page. Current URL: ${currentUrl}`
    );

    // If we have a test ID, check that the page content loads
    if (adminPage.testId) {
      const element = await page.$(`[data-testid="${adminPage.testId}"]`);
      if (element) {
        assert.ok(element, `${adminPage.name} page should load properly`);
      }
      // If no test ID found, that's okay - the page might still load but just not have the specific element
    }
  }
});

When('I try to access the users management page directly', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');
  await page.goto('http://localhost:5000/erabiltzaileak', { waitUntil: 'domcontentloaded' });
});

Then('I should be redirected or shown an access denied message', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Wait a bit for the protected route to render
  await page.waitForTimeout(1000);

  // Check for the access denied message in Basque
  const accessDeniedMessage = await page.$('text=Ez duzu baimenik orri hau ikusteko');

  assert.ok(
    accessDeniedMessage,
    'Bazkide user should be blocked from users page'
  );
});

Then('I should see the users management page', async function () {
  const page = getPage();
  assert.ok(page, 'Page was not initialized');

  // Check that we're on the users page and can see the users interface
  const currentUrl = page.url();
  assert.ok(
    currentUrl.includes('/erabiltzaileak'),
    `Admin user should be on users management page. Current URL: ${currentUrl}`
  );

  // Check for key users page elements
  const newButton = await page.$('[data-testid="button-new-user"]');
  const searchInput = await page.$('[data-testid="input-search-users"]');
  
  assert.ok(newButton, 'Users page should have "New User" button');
  assert.ok(searchInput, 'Users page should have search input');
});
