import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

Given("I navigate to the stock take page", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.goto(e2eUrl("/inbentarioa"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="page-stock-take"]', { state: "visible" });
});

Given("I clear any stock take draft if present", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");

  const newBtn = page.locator('[data-testid="button-new-stock-take"]');
  await newBtn.waitFor({ state: "visible", timeout: 15000 });

  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await newBtn.isDisabled())) {
      return;
    }

    const bannerResume = page.locator('[data-testid="link-resume-stock-take"]').first();
    const headerResume = page.locator('[data-testid="button-resume-stock-take-header"]').first();

    if (await bannerResume.isVisible().catch(() => false)) {
      await bannerResume.click();
    } else if (await headerResume.isVisible().catch(() => false)) {
      await headerResume.click();
    } else {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="page-stock-take"]');
      continue;
    }

    await page.waitForSelector('[data-testid="button-cancel-stock-take"]', {
      state: "visible",
      timeout: 30000,
    });
    await page.click('[data-testid="button-cancel-stock-take"]');
    await page.waitForTimeout(2500);
    await page.waitForSelector('[data-testid="button-new-stock-take"]', { state: "visible" });
  }

  assert.ok(
    !(await newBtn.isDisabled()),
    "Could not clear stock take draft; new stock take still disabled"
  );
});

When("I open the new stock take dialog", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click('[data-testid="button-new-stock-take"]');
  await page.waitForSelector('[data-testid="button-confirm-new-stock-take"]', { state: "visible" });
});

When("I confirm creating the stock take", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click('[data-testid="button-confirm-new-stock-take"]');
  await page.waitForTimeout(500);
});

Then("I should see the stock take detail with cancel action", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.waitForSelector('[data-testid="button-cancel-stock-take"]', {
    state: "visible",
    timeout: 60000,
  });
});

When("I cancel the stock take from the detail view", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  await page.click('[data-testid="button-cancel-stock-take"]');
  await page.waitForTimeout(2500);
});

Then("the new stock take button should be enabled", async function () {
  const page = getPage();
  if (!page) throw new Error("Page not available");
  const newBtn = page.locator('[data-testid="button-new-stock-take"]');
  assert.ok(!(await newBtn.isDisabled()), "New stock take button should be enabled after cancel");
});
