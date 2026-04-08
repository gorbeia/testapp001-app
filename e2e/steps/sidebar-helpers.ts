import type { Page } from "playwright";

/** Matches `group.id` on collapsible submenus in `AppSidebar.tsx`. */
const SUBMENU_TRIGGER_GROUP_IDS = [
  "mgmt-people",
  "mgmt-inventory",
  "mgmt-finance",
  "cfg-space",
  "cfg-society",
] as const;

/** Desktop sidebar may start collapsed (cookie); ensure nav links are in view. */
export async function ensureSidebarNavReady(page: Page): Promise<void> {
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

/**
 * Expand nested sidebar groups (Radix Collapsible) so child `link-*` entries are visible.
 * Safe to call when a role has no submenus (triggers are absent).
 */
export async function expandAllSidebarSubmenus(page: Page): Promise<void> {
  await ensureSidebarNavReady(page);
  for (const id of SUBMENU_TRIGGER_GROUP_IDS) {
    const trigger = page.locator(`[data-testid="sidebar-submenu-trigger-${id}"]`);
    if ((await trigger.count()) === 0) continue;
    if (!(await trigger.isVisible().catch(() => false))) continue;
    const state = await trigger.getAttribute("data-state");
    if (state === "open") continue;
    await trigger.click();
  }
}

export async function clickSidebarNavLink(page: Page, linkTestId: string): Promise<void> {
  await expandAllSidebarSubmenus(page);
  const link = page.locator(`[data-testid="${linkTestId}"]`).first();
  await link.waitFor({ state: "visible", timeout: 15_000 });
  await link.click();
}
