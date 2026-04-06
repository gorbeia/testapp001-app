import { Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { getPage } from "./shared-state";

Then("I should see the Zorrak treasurer actions column", async function () {
  const page = getPage();
  assert.ok(page);
  await page.waitForSelector('[data-testid="credits-page"]', { timeout: 10000 });
  const header = await page.$("text=Ekintzak");
  assert.ok(header, "Expected Actions (Ekintzak) column for treasurer on Zorrak");
});
