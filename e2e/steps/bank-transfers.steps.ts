import { When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage, e2eUrl } from "./shared-state";

When("I navigate to the bank transfers page", async function () {
  const page = getPage();
  assert.ok(page);
  await page.goto(e2eUrl("/transferentziak"), { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="bank-transfers-page"]', { timeout: 10000 });
});

When(
  "I submit a bank transfer proposal from my movements page",
  { timeout: 30 * 1000 },
  async function () {
    const page = getPage();
    assert.ok(page);
    await page.waitForSelector('[data-testid="my-movements-page"]', { timeout: 10000 });
    const proposeBtn = page.locator('[data-testid="button-propose-transfer"]');
    await proposeBtn.scrollIntoViewIfNeeded();
    await proposeBtn.click();
    await page.waitForSelector('[data-testid="dialog-propose-transfer"]');
    await page.fill('[data-testid="input-transfer-proposal-amount"]', "12.34");
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('[data-testid="input-transfer-proposal-date"]', today);
    await page.fill('[data-testid="input-transfer-proposal-reference"]', "E2E-MEMBER-REF");
    const submitBtn = page.locator('[data-testid="button-submit-transfer-proposal"]');
    await submitBtn.scrollIntoViewIfNeeded();
    const [response] = await Promise.all([
      page.waitForResponse(
        r =>
          r.url().includes("/api/bank-transfers/me") &&
          r.request().method() === "POST" &&
          r.ok(),
        { timeout: 20000 }
      ),
      submitBtn.click(),
    ]);
    assert.ok(response.ok(), `POST /api/bank-transfers/me failed: ${response.status()}`);
    const body = (await response.json()) as { id?: string; status?: string };
    assert.ok(body?.id, "Expected JSON body with transfer id from POST /api/bank-transfers/me");
    assert.strictEqual(body.status, "pending");
    await page.waitForSelector(`[data-testid="transfer-proposal-row-${body.id}"]`, { timeout: 15000 });
    await page.waitForSelector('[data-testid="dialog-propose-transfer"]', { state: "hidden", timeout: 15000 });
  }
);

When("I create a pending bank transfer for Miren Urrutia", async function () {
  const page = getPage();
  assert.ok(page);
  await page.click('[data-testid="button-new-transfer"]');
  await page.waitForSelector('[data-testid="dialog-new-transfer"]');
  await page.click('[data-testid="select-transfer-user"]');
  await page.getByRole("option", { name: "Miren Urrutia" }).click();
  await page.fill('[data-testid="input-transfer-amount"]', "12.34");
  const today = new Date().toISOString().slice(0, 10);
  await page.fill('[data-testid="input-transfer-date"]', today);
  await page.fill('[data-testid="input-transfer-reference"]', "E2E-REF");
  await page.click('[data-testid="button-save-transfer"]');
  await page.waitForTimeout(1500);
});

When(
  "I validate the first pending bank transfer",
  { timeout: 30 * 1000 },
  async function () {
    const page = getPage();
    assert.ok(page);
    const validateBtn = page.locator('[data-testid^="button-validate-"]').first();
    await validateBtn.scrollIntoViewIfNeeded();
    await validateBtn.waitFor({ state: "visible", timeout: 25000 });
    await validateBtn.click();
    await page.waitForTimeout(1500);
  }
);
