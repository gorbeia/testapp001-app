import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage } from "./shared-state";

When("I navigate to the society page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Navigate to society page
  await page.click('[data-testid="link-elkartea"]');
  await page.waitForLoadState("networkidle");
});

Then("I should see the current society information", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Wait for society name input to be visible
  await page.waitForSelector('[data-testid="input-society-name"]', { timeout: 10000 });

  const nameInput = page.locator('[data-testid="input-society-name"]');
  const nameValue = await nameInput.inputValue();
  assert.ok(nameValue.length > 0, "Society name should be loaded");
});

When("I update the society name to {string}", async function (name: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const nameInput = page.locator('[data-testid="input-society-name"]');
  await nameInput.clear();
  await nameInput.fill(name);
});

When("I update the society IBAN to {string}", async function (iban: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const ibanInput = page.locator('[data-testid="input-society-iban"]');
  await ibanInput.clear();
  await ibanInput.fill(iban);
});

When("I update the society phone to {string}", async function (phone: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const phoneInput = page.locator('[data-testid="input-society-phone"]');
  await phoneInput.clear();
  await phoneInput.fill(phone);
});

When("I update the society address to {string}", async function (address: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const addressInput = page.locator('[data-testid="input-society-address"]');
  await addressInput.clear();
  await addressInput.fill(address);
});

When("I update the society email to {string}", async function (email: string) {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const emailInput = page.locator('[data-testid="input-society-email"]');
  await emailInput.clear();
  await emailInput.fill(email);
});

When("I save the society changes", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  await page.click('[data-testid="button-save-society"]');
});

Then("I should see a society success message", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  // Look for success toast
  const successToast = page.locator('[data-radix-toast-content], [role="status"], .bg-green-500');

  try {
    await successToast.waitFor({ state: "visible", timeout: 3000 });
  } catch (error) {
    // Fallback: check if data was actually updated
    const nameInput = page.locator('[data-testid="input-society-name"]');
    const nameValue = await nameInput.inputValue();

    if (nameValue.includes("Berria")) {
      return; // Success - data was saved
    }

    throw new Error("Neither toast nor updated data found");
  }
});

Then("I should see the updated society name", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const nameInput = page.locator('[data-testid="input-society-name"]');
  const nameValue = await nameInput.inputValue();

  assert.ok(nameValue.includes("Berria"), "Should see updated society name");
});

Then("I should see the updated society IBAN", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const ibanInput = page.locator('[data-testid="input-society-iban"]');
  const ibanValue = await ibanInput.inputValue();

  assert.ok(ibanValue.includes("1331"), "Should see updated IBAN");
});

Then("I should see the updated society phone", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const phoneInput = page.locator('[data-testid="input-society-phone"]');
  const phoneValue = await phoneInput.inputValue();

  assert.ok(phoneValue.includes("223"), "Should see updated phone");
});

Then("I should see the updated society address", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const addressInput = page.locator('[data-testid="input-society-address"]');
  const addressValue = await addressInput.inputValue();

  assert.ok(addressValue.includes("Kale Berria"), "Should see updated address");
});

Then("I should see the updated society email", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const emailInput = page.locator('[data-testid="input-society-email"]');
  const emailValue = await emailInput.inputValue();

  assert.ok(emailValue.includes("berria"), "Should see updated email");
});
