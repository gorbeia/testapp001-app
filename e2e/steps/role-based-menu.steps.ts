import { Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { getPage, e2eUrl, e2eDebug, E2E_BASE_URL } from "./shared-state";

const ACCESS_DENIED_SNIPPET = "Ez duzu baimenik orri hau ikusteko";

/** Dashboard + member-facing nav (demo society has SEPA enabled → personal credits link). */
const COMMON_MAIN_MENU = [
  "link-home",
  "link-erreserbak",
  "link-nire-erreserbak",
  "link-kontsumoak",
  "link-nire-konsumoak",
  "link-nire-zorrak",
  "link-nire-mugimenduak",
];

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

/** Desktop sidebar may start collapsed (cookie); ensure nav links are in view for assertions. */
async function ensureSidebarNavReady(page: Page): Promise<void> {
  const home = page.locator('[data-testid="link-home"]');
  try {
    await home.waitFor({ state: "visible", timeout: 3_000 });
    return;
  } catch {
    /* collapsed / sheet */
  }
  const toggle = page.locator('[data-testid="button-sidebar-toggle"]');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await home.waitFor({ state: "visible", timeout: 10_000 });
  }
}

async function assertTestIdsVisible(page: Page, testIds: string[], message: string): Promise<void> {
  await ensureSidebarNavReady(page);
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
  await assertTestIdsVisible(page, COMMON_MAIN_MENU, "Main menu");
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
  await assertTestIdsVisible(page, [...ADMIN_MANAGEMENT_LINKS, ANNOUNCEMENTS_LINK], "Admin management");
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
      "/admin-erreserbak",
      "/kontsumoak-zerrenda",
      "/mahaiak",
      "/kategoriak",
      "/subscriptions",
      "/oharrak",
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
      "/oharrak",
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
      "/admin-erreserbak",
      "/mahaiak",
      "/kategoriak",
      "/subscriptions",
      "/oharrak",
    ];

    for (const p of deniedPaths) {
      await assertAccessDeniedForPath(page, p);
    }
  }
);

Then("API calls to admin-protected endpoints should return 403", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");

  const status = await page.evaluate(async (origin: string) => {
    const res = await fetch(`${origin}/api/users`, { credentials: "include" });
    return res.status;
  }, E2E_BASE_URL);

  assert.equal(status, 403, "Member should get 403 on GET /api/users");
});

Then("API calls to user-management endpoints should return 403", async function () {
  const page = getPage();
  assert.ok(page, "Page was not initialized");

  const status = await page.evaluate(async (origin: string) => {
    const res = await fetch(`${origin}/api/users`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.status;
  }, E2E_BASE_URL);

  assert.equal(status, 403, "Treasurer should get 403 on POST /api/users (users.manage)");
});
