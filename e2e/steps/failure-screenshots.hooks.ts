import { After, Status } from "@cucumber/cucumber";
import fs from "node:fs";
import path from "node:path";
import { getPage } from "./shared-state";

const SCREENSHOT_DIR = path.join(process.cwd(), "e2e/artifacts/screenshots");

function shouldCaptureFailure(status: string | undefined, hookError: unknown): boolean {
  if (hookError) return true;
  return status === Status.FAILED || status === Status.UNDEFINED || status === Status.AMBIGUOUS;
}

function screenshotPath(pickleName: string, featureUri: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const featureBase = path.basename(
    featureUri || "feature",
    path.extname(featureUri || ".feature")
  );
  const safeFeature = featureBase.replace(/[^\w.-]+/g, "_");
  const safeScenario = pickleName.replace(/[^\w\u00C0-\u024f.-]+/gi, "_").slice(0, 96);
  return path.join(SCREENSHOT_DIR, `${ts}__${safeFeature}__${safeScenario}.png`);
}

After(async function ({ pickle, result, error, willBeRetried }) {
  if (willBeRetried) return;
  if (process.env.E2E_SCREENSHOTS === "0" || process.env.E2E_SCREENSHOTS === "false") {
    return;
  }

  if (!shouldCaptureFailure(result?.status, error)) return;

  const page = getPage();
  if (!page) return;

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = screenshotPath(pickle.name, pickle.uri);

  try {
    await page.screenshot({ path: file, fullPage: true });
    console.error(`\n[E2E] Failure screenshot: ${file}\n`);
  } catch (e) {
    console.error("[E2E] Screenshot failed:", e);
  }
});
