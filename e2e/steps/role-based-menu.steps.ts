import { Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { getPage, e2eUrl, e2eDebug } from "./shared-state";
import { ensureSidebarNavReady, expandAllSidebarSubmenus } from "./sidebar-helpers";

const ACCESS_DENIED_SNIPPET = "Ez duzu baimenik orri hau ikusteko";

/** Always shown for logged-in society users (credits link is SEPA-dependent — see below). */
const MAIN_MENU_CORE = [
  "link-home",
  "link-egutegia",
  "link-nire-erreserbak",
  "link-kontsumoak",
  "link-nire-konsumoak",
  "link-nire-mugimenduak",
  "link-jakinarazpenak",
];

/** “Nire zorrak” is omitted from the sidebar when society SEPA mode is disabled. */
async function assertPersonalCreditsLinkIfPresent(page: Page): Promise<void> {
  await ensureSidebarNavReady(page);
  const loc = page.locator('[data-testid="link-nire-zorrak"]');
  if ((await loc.count()) === 0) return;
  await loc.first().waitFor({ state: "visible", timeout: 15_000 });
}

const ANNOUNCEMENTS_LINK = "link-oharrak";

/** Full “Kudeaketa” links for admin. */
const ADMIN_MANAGEMENT_LINKS = [
  "link-erabiltzaileak",
  "link-admin-erreserbak",
  "link-kontsumoak-zerrenda",
  "link-zorrak",
  "link-produktuak",
  "link-sepa",
  "link-mugimenduak",
  "link-transferentziak",
];

const CONFIG_LINKS = ["link-mahaiak", "link-kategoriak", "link-subscriptions", "link-elkartea"];

const TREASURER_MANAGEMENT_LINKS = [
  "link-admin-erreserbak",
  "link-zorrak",
  "link-sepa",
  "link-mugimenduak",
  "link-transferentziak",
];

const ADMIN_ONLY_MANAGEMENT_LINKS = [
  "link-erabiltzaileak",
  "link-produktuak",
  "link-kontsumoak-zerrenda",
];

const ADMIN_ONLY_CONFIG_LINKS = ["link-mahaiak", "link-subscriptions"];

const TREASURER_CONFIG_LINKS = ["link-elkartea", "link-kategoriak"];

const CELLARMAN_MANAGEMENT_LINKS = ["link-produktuak", "link-kontsumoak-zerrenda"];

const FINANCIAL_MANAGEMENT_LINKS = [
  "link-zorrak",
  "link-sepa",
  "link-mugimenduak",
  "link-transferentziak",
];

/** Any sidebar link that implies staff config or management beyond a plain member. */
const ALL_STAFF_NAV_TEST_IDS = Array.from(
  new Set([...ADMIN_MANAGEMENT_LINKS, ...CONFIG_LINKS, ANNOUNCEMENTS_LINK])
);

async function assertTestIdsVisible(page: Page, testIds: string[], message: string): Promise<void> {
  await expandAllSidebarSubmenus(page);
  for (const id of testIds) {
    const loc = page.locator(`[data-testid="${id}"]`).first();
    await loc.waitFor({ state: "visible", timeout: 15_000 });
    assert.ok(await loc.isVisible(), `${message}: expected ${id} to be visible`);
  }
}

async function assertTestIdsHidden(page: Page, testIds: string[], message: string): Promise<void> {
  for (const id of testIds) {
    const element = await page.$(`[data-testid="${id}"]`);
    assert.ok(!element, `${message}: expected ${id} to be absent`);
  }
}

async function assertAccessDeniedForPath(page: Page, path: string): Promise<void> {
  await page.goto(e2eUrl(path), { waitUntil: "domcontentloaded", timeout: 15_000 });
  e2eDebug(`Navigated to ${path} — checking access denied`);
  const denied = page.locator(`text=${ACCESS_DENIED_SNIPPET}`).first();
  await denied.waitFor({ state: "visible", timeout: 10_000 });
  assert.ok(await denied.isVisible(), `Expected access denied message for ${path}`);
}

Then("I should see the main menu entries", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  await assertTestIdsVisible(page, MAIN_MENU_CORE, "Main menu");
  await assertPersonalCreditsLinkIfPresent(page);
});

Then("I should not see the announcements menu link", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  await ensureSidebarNavReady(page);
  await assertTestIdsHidden(page, [ANNOUNCEMENTS_LINK], "Announcements");
});

Then("I should see admin management links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  const adminSection = page.locator("text=Kudeaketa").first();
  await adminSection.waitFor({ state: "visible", timeout: 15_000 });
  assert.ok(await adminSection.isVisible(), 'Admin section "Kudeaketa" should be visible');
  await assertTestIdsVisible(
    page,
    [...ADMIN_MANAGEMENT_LINKS, ANNOUNCEMENTS_LINK],
    "Admin management"
  );
});

Then("I should see config links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  const configSection = await page.$("text=Konfigurazioa");
  assert.ok(configSection, 'Config section "Konfigurazioa" should be visible');
  await assertTestIdsVisible(page, CONFIG_LINKS, "Config");
});

Then("I should see treasurer management links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  const adminSection = await page.$("text=Kudeaketa");
  assert.ok(adminSection, 'Management section "Kudeaketa" should be visible for treasurer');
  await assertTestIdsVisible(page, TREASURER_MANAGEMENT_LINKS, "Treasurer management");
});

Then("I should not see admin-only management links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  await ensureSidebarNavReady(page);
  await assertTestIdsHidden(page, ADMIN_ONLY_MANAGEMENT_LINKS, "Admin-only management");
});

Then("I should not see admin-only config links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  await ensureSidebarNavReady(page);
  await assertTestIdsHidden(page, ADMIN_ONLY_CONFIG_LINKS, "Admin-only config");
});

Then("I should see treasurer config links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  const configSection = await page.$("text=Konfigurazioa");
  assert.ok(configSection, "Config section should be visible for treasurer");
  await assertTestIdsVisible(page, TREASURER_CONFIG_LINKS, "Treasurer config");
});

Then("I should see cellarman management links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  const adminSection = await page.$("text=Kudeaketa");
  assert.ok(adminSection, 'Management section "Kudeaketa" should be visible for cellarman');
  await assertTestIdsVisible(page, CELLARMAN_MANAGEMENT_LINKS, "Cellarman management");
});

Then("I should not see financial management links", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  await ensureSidebarNavReady(page);
  await assertTestIdsHidden(page, FINANCIAL_MANAGEMENT_LINKS, "Financial management");
});

Then("I should not see any management entries", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");
  await ensureSidebarNavReady(page);

  const managementHeading = await page.$("text=Kudeaketa");
  assert.ok(!managementHeading, 'Management section "Kudeaketa" should not be visible');

  const configHeading = await page.$("text=Konfigurazioa");
  assert.ok(!configHeading, 'Config section "Konfigurazioa" should not be visible');

  await assertTestIdsHidden(page, ALL_STAFF_NAV_TEST_IDS, "Staff-only sidebar links");
});

Then(
  "I should not be able to access protected pages as a member",
  { timeout: 120_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page was not initialized");

    const deniedPaths = [
      "/erabiltzaileak",
      "/produktuak",
      "/zorrak",
      "/sepa",
      "/mugimenduak",
      "/transferentziak",
      "/elkartea",
      "/erreserba-ezarpenak",
      "/admin-erreserbak",
      "/kontsumoak-zerrenda",
      "/mahaiak",
      "/kategoriak",
      "/subscriptions",
    ];

    for (const p of deniedPaths) {
      await assertAccessDeniedForPath(page, p);
    }
  }
);

Then(
  "I should not be able to access admin-only pages as a treasurer",
  { timeout: 90_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page was not initialized");

    const deniedPaths = [
      "/erabiltzaileak",
      "/produktuak",
      "/kontsumoak-zerrenda",
      "/mahaiak",
      "/subscriptions",
    ];

    for (const p of deniedPaths) {
      await assertAccessDeniedForPath(page, p);
    }
  }
);

Then(
  "I should not be able to access financial pages as a cellarman",
  { timeout: 90_000 },
  async function () {
    const page = getPage();
    assert.ok(page, "Page was not initialized");

    const deniedPaths = [
      "/erabiltzaileak",
      "/zorrak",
      "/sepa",
      "/mugimenduak",
      "/transferentziak",
      "/elkartea",
      "/erreserba-ezarpenak",
      "/admin-erreserbak",
      "/mahaiak",
      "/kategoriak",
      "/subscriptions",
    ];

    for (const p of deniedPaths) {
      await assertAccessDeniedForPath(page, p);
    }
  }
);
