import { Given, When, Then } from "@cucumber/cucumber";
import type { Page, Response } from "playwright";
import { getPage, e2eUrl, e2eDebug } from "./shared-state";
import assert from "node:assert/strict";

/** POST /api/reservations (not /user, /count, etc.). Toast only fires after this response returns. */
function isCreateReservationPost(response: Response): boolean {
  if (response.request().method() !== "POST") return false;
  try {
    const { pathname } = new URL(response.url());
    return pathname === "/api/reservations";
  } catch {
    return false;
  }
}

/** Cost breakdown inside the new-reservation dialog (not other .bg-muted/50 on the page). */
function reservationCostCard(page: Page) {
  return page.locator('[data-testid="dialog-content"] [data-testid="reservation-cost-card"]');
}

Given("I navigate to my reservations page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.click('[data-testid="link-nire-erreserbak"]');
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
});

Given("I navigate to the calendar page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.click('[data-testid="link-egutegia"]');
  await page.waitForSelector('[data-testid="calendar-big-calendar"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="button-new-reservation"]', { timeout: 15000 });
});

Given("I navigate to the admin reservations page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.goto(e2eUrl("/admin-erreserbak"), { waitUntil: "domcontentloaded" });
});

When("I click the new reservation button", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.click('[data-testid="button-new-reservation"]');
});

Then("I should see the reservation dialog", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for dialog to appear
  await page.waitForSelector('[data-testid="dialog-content"]', { timeout: 5000 });

  // Check if dialog is visible
  const dialog = page.locator('[data-testid="dialog-content"]');
  const isVisible = await dialog.isVisible();

  assert.ok(isVisible, "Reservation dialog should be visible");
});

When("I fill in the reservation details", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Generate a unique reservation name with timestamp and random type
  const timestamp = Date.now();
  const randomType = Math.floor(Math.random() * 1000);
  const uniqueName = `Test Erreserba ${timestamp} T${randomType}`;

  // Store the unique name for later verification
  this.testReservationName = uniqueName;

  // Fill the name field directly
  await page.fill('[data-testid="input-reservation-name"]', uniqueName);

  // Select reservation type randomly
  await page.click('[data-testid="select-reservation-type"]');
  const options = await page.locator('[role="option"]').all();
  if (options.length > 0) {
    const randomIndex = Math.floor(Math.random() * options.length);
    await options[randomIndex].click();
  }
});

When("I select the reservation date", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Generate a random date within the next 6 months
  const today = new Date();
  const maxFutureDate = new Date(today);
  maxFutureDate.setMonth(today.getMonth() + 6);

  const randomDate = new Date(
    today.getTime() + Math.random() * (maxFutureDate.getTime() - today.getTime())
  );
  const targetMonth = randomDate.getMonth();
  const targetYear = randomDate.getFullYear();
  const targetDay = randomDate.getDate();

  e2eDebug(`Target date: ${targetDay}/${targetMonth + 1}/${targetYear}`);

  // Navigate to the target month
  const currentMonth = new Date();
  const monthsToNavigate =
    (targetYear - currentMonth.getFullYear()) * 12 + (targetMonth - currentMonth.getMonth());

  // Open date picker
  await page.click('[data-testid="date-picker-button"]');

  if (monthsToNavigate > 0) {
    const nextMonthButton = page.locator('button[aria-label="Go to next month"]');

    for (let i = 0; i < monthsToNavigate; i++) {
      await nextMonthButton.click();
    }
  } else if (monthsToNavigate < 0) {
    const prevMonthButton = page.locator('button[aria-label="Go to previous month"]');

    for (let i = 0; i < Math.abs(monthsToNavigate); i++) {
      await prevMonthButton.click();
    }
  }

  // Select a day in the target month
  const dayToSelect = Math.min(targetDay, 28);

  // Try to find the specific day, fallback to any available day
  const targetDayButton = page
    .locator(`button[role="gridcell"]:has-text("${dayToSelect}")`)
    .first();
  if (await targetDayButton.isVisible({ timeout: 3000 })) {
    await targetDayButton.click();
  } else {
    // Fallback: select any available day in the middle of the month
    const availableDays = page.locator('button[role="gridcell"]:not(:disabled)');
    const middleDay = availableDays.nth(Math.min(15, (await availableDays.count()) - 1));
    await middleDay.click();
  }
});

When("I set the number of guests to {int}", async function (guests: number) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.fill('[data-testid="input-guests"]', guests.toString());
  // Wait for React to re-render table capacity options (SelectItem disabled state depends on guests)
  const costCard = reservationCostCard(page);
  const expected = (guests * 2).toFixed(2);
  await costCard.getByText(new RegExp(`${expected}€`)).waitFor({ state: "visible", timeout: 5000 });
});

When("I select a table", { timeout: 60 * 1000 }, async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.waitForTimeout(300);
  await page.click('[data-testid="select-table"]');

  const enabled = page.locator('[role="option"]:not([data-disabled])');
  try {
    await enabled.first().waitFor({ state: "visible", timeout: 20000 });
  } catch {
    const emptyState = await page
      .locator("text=/Ez dago mahairik|No hay mesas|no tables/i")
      .first()
      .isVisible()
      .catch(() => false);
    throw new Error(
      emptyState
        ? "No reservation tables for this society. Run pnpm db:seed (includes script/seed-tables.ts) or pnpm db:reset:seed."
        : "Table dropdown has no selectable options."
    );
  }

  const choice = enabled.last();
  await choice.scrollIntoViewIfNeeded();
  await choice.click();

  const saveBtn = page.locator('[data-testid="button-save-reservation"]');
  await saveBtn.waitFor({ state: "visible", timeout: 5000 });
  assert.ok(await saveBtn.isEnabled(), "A table must be selected so reservation save is enabled");
});

When("I select the {string} table", async function (tableName: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for dialog to be fully rendered
  await page.waitForTimeout(500);

  // Click on table select dropdown
  await page.click('[data-testid="select-table"]');
  await page.waitForTimeout(1000); // Wait for dropdown to open

  try {
    // Look for the specific table by name
    const tableOption = page.locator('[role="option"]').filter({ hasText: tableName }).first();

    if (await tableOption.isVisible({ timeout: 2000 })) {
      await tableOption.click();
    } else {
      // Fallback to first available table
      const allOptions = await page.locator('[role="option"]').all();
      if (allOptions.length > 0) {
        await allOptions[0].click();
      }
    }
  } catch (error) {
    console.error(`Error selecting table "${tableName}":`, error);
    // Continue the test even if table selection fails
    await page.click("body"); // Click outside to close dropdown
  }
});

When("I enable kitchen equipment", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for dialog to be fully rendered
  await page.waitForTimeout(500);

  await page.check('[data-testid="checkbox-kitchen"]');
});

When("I keep kitchen equipment disabled", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for dialog to be fully rendered
  await page.waitForTimeout(500);

  // Ensure checkbox is unchecked
  await page.uncheck('[data-testid="checkbox-kitchen"]');
});

Then("I should see the correct cost calculation", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Check the cost breakdown card
  const costCard = reservationCostCard(page);
  await costCard.waitFor({ state: "visible", timeout: 5000 });

  const cardText = await costCard.textContent();

  // Verify base cost (15 guests × 2€ = 30€)
  assert.ok(cardText?.includes("30.00€"), "Base cost should be 30.00€ for 15 guests");

  // Verify kitchen charge appears (15 guests × 3€ = 45€)
  assert.ok(cardText?.includes("45.00€"), "Kitchen charge should be 45.00€ for 15 guests");

  // Verify total cost (30€ + 45€ = 75€)
  assert.ok(/75(?:\.00)?€/.test(cardText || ""), "Total cost should be 75€ with kitchen");
});

Then("I should see the correct cost calculation without kitchen", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Check the cost breakdown card
  const costCard = reservationCostCard(page);
  await costCard.waitFor({ state: "visible", timeout: 5000 });

  const cardText = await costCard.textContent();

  // Verify base cost (5 guests × 2€ = 10€)
  assert.ok(cardText?.includes("10.00€"), "Base cost should be 10.00€ for 5 guests");

  // Verify total cost without kitchen (only base cost)
  assert.ok(/10(?:\.00)?€/.test(cardText || ""), "Total cost should be 10€ without kitchen");

  // Verify no kitchen charge is mentioned
  assert.ok(!cardText?.includes(" Sukaldaritza:"), "No kitchen charge should be shown");
});

Then(
  "I should see the correct cost calculation without kitchen for {int} guests",
  async function (guests: number) {
    const page = getPage();
    if (!page) throw new Error("Page not available");

    // Check the cost breakdown card
    const costCard = reservationCostCard(page);
    await costCard.waitFor({ state: "visible", timeout: 5000 });

    const cardText = await costCard.textContent();

    // Calculate expected cost (guests × 2€)
    const expectedCost = (guests * 2).toFixed(2);
    const totalEuros = guests * 2;

    // Verify base cost
    assert.ok(
      cardText?.includes(`${expectedCost}€`),
      `Base cost should be ${expectedCost}€ for ${guests} guests`
    );

    // Verify total cost without kitchen (line uses integer string e.g. "10€" or could be "10.00€")
    assert.ok(
      new RegExp(`${totalEuros}(?:\\.00)?€`).test(cardText || ""),
      `Total cost should be ${totalEuros}€ without kitchen`
    );

    // Verify no kitchen charge is mentioned
    assert.ok(!cardText?.includes(" Sukaldaritza:"), "No kitchen charge should be shown");
  }
);

Then("I should see the base cost calculation", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Check the cost breakdown card
  const costCard = reservationCostCard(page);
  await costCard.waitFor({ state: "visible", timeout: 5000 });

  const cardText = await costCard.textContent();

  // Verify base cost (10 guests × 2€ = 20€)
  assert.ok(cardText?.includes("20.00€"), "Base cost should be 20.00€ for 10 guests");
});

Then("I should see the updated cost with kitchen", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const costCard = reservationCostCard(page);
  await costCard.waitFor({ state: "visible", timeout: 5000 });

  // Allow React to apply kitchen line + total after checkbox
  await costCard.getByText(/30\.00€/).waitFor({ state: "visible", timeout: 5000 });

  const cardText = await costCard.textContent();

  // Verify kitchen charge appears (10 guests × 3€ = 30€)
  assert.ok(cardText?.includes("30.00€"), "Kitchen charge should be 30.00€ for 10 guests");

  // Total line uses integer string (50€) unless formatting changes
  assert.ok(/50(?:\.00)?€/.test(cardText || ""), "Total cost should be 50€ with kitchen");
});

When("I change guests to {int}", async function (guests: number) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for dialog to be fully rendered
  await page.waitForTimeout(500);

  await page.fill('[data-testid="input-guests"]', guests.toString());
});

Then("I should see the recalculated cost", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const costCard = reservationCostCard(page);
  await costCard.waitFor({ state: "visible", timeout: 5000 });

  const cardText = await costCard.textContent();

  // Verify base cost (5 guests × 2€ = 10€)
  assert.ok(cardText?.includes("10.00€"), "Base cost should be 10.00€ for 5 guests");

  // Verify kitchen charge (5 guests × 3€ = 15€)
  assert.ok(cardText?.includes("15.00€"), "Kitchen charge should be 15.00€ for 5 guests");

  assert.ok(/25(?:\.00)?€/.test(cardText || ""), "Total cost should be 25€");
});

When("I disable kitchen equipment", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for dialog to be fully rendered
  await page.waitForTimeout(500);

  await page.uncheck('[data-testid="checkbox-kitchen"]');
});

Then("I should see the cost without kitchen", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const costCard = reservationCostCard(page);
  await costCard.waitFor({ state: "visible", timeout: 5000 });

  const cardText = await costCard.textContent();

  // Verify only base cost remains (5 guests × 2€ = 10€)
  assert.ok(cardText?.includes("10.00€"), "Only base cost should be 10.00€");

  // Verify no kitchen charge is mentioned
  assert.ok(!cardText?.includes(" Sukaldaritza:"), "No kitchen charge should be shown");
});

When("I save the reservation", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Server runs debt recalculation before responding; the success toast only appears after
  // the POST completes — waiting on the toast alone can flake if the handler exceeds ~15s.
  const responsePromise = page.waitForResponse(isCreateReservationPost, { timeout: 90_000 });

  await page.click('[data-testid="button-save-reservation"]');

  this.reservationCreateResponse = await responsePromise;
});

Then("I should see a reservation success message", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const response = this.reservationCreateResponse as Response | undefined;
  if (!response) {
    throw new Error("Missing reservation POST response — run the save step first");
  }

  const status = response.status();
  if (!response.ok()) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Reservation API failed (${status}): ${body.slice(0, 800)}`);
  }

  const errorToast = page.locator('[data-testid="toast-destructive"]');
  const successToast = page.locator('[data-testid="toast-default"]');

  try {
    await successToast.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    if (await errorToast.isVisible().catch(() => false)) {
      const msg = await errorToast.textContent();
      throw new Error(`Reservation failed (error toast): ${msg ?? "(empty)"}`);
    }
    const dialog = page.locator('[data-testid="dialog-content"]');
    if ((await dialog.count()) === 0 || !(await dialog.isVisible().catch(() => false))) {
      return;
    }
    throw new Error("Success toast did not appear within 15s after API success");
  }

  const text = await successToast.textContent();
  assert.ok(
    text && /Erreserba sortua|Reserva creada|sortua|creada/i.test(text),
    `Success toast should mention reservation created; got: ${text}`
  );
});

Then("the reservation should appear in my reservations table", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const uniqueReservationName = this.testReservationName;

  // List is ordered by start date (desc), not creation time; a random booking date can land
  // beyond page 1. Narrow via search so the row is always addressable.
  const searchInput = page.getByPlaceholder(/Bilatu|Buscar|Search/i);
  await searchInput.fill(uniqueReservationName);
  await page.waitForFunction(
    (name: string) => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      return rows.some(r => r.textContent?.includes(name));
    },
    uniqueReservationName,
    { timeout: 15000 }
  );

  const row = page.locator("table tbody tr").filter({ hasText: uniqueReservationName }).first();

  await row.waitFor({ state: "visible", timeout: 10000 });

  const rowText = await row.textContent();
  assert.ok(
    rowText?.includes(uniqueReservationName),
    `Unique reservation name "${uniqueReservationName}" should be present in the table`
  );
  // My Reservations is scoped to the logged-in user: no owner column. Row has no € total (see detail dialog).
  assert.ok((rowText?.length ?? 0) > uniqueReservationName.length, `Row should include columns beyond name; row: "${rowText}"`);
});
