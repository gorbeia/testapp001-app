// Shared state for E2E tests (TypeScript version)
import { Page, Browser } from "playwright";

export { e2eUrl, E2E_BASE_URL } from "./base-url";

/** Step diagnostics; off by default. Enable with `E2E_DEBUG=1 pnpm test:e2e`. */
export function e2eDebug(...args: unknown[]): void {
  const on = process.env.E2E_DEBUG === "1" || process.env.E2E_DEBUG === "true";
  if (on) {
    console.log(...args);
  }
}

let browser: Browser | null = null;
let page: Page | null = null;

export const getBrowser = (): Browser | null => browser;
export const setBrowser = (newBrowser: Browser): void => {
  browser = newBrowser;
};
export const getPage = (): Page | null => page;
export const setPage = (newPage: Page): void => {
  page = newPage;
};
