// Shared state for E2E tests (TypeScript version)
import { Page, Browser } from 'playwright';

let browser: Browser | null = null;
let page: Page | null = null;

export const getBrowser = (): Browser | null => browser;
export const setBrowser = (newBrowser: Browser): void => { browser = newBrowser; };
export const getPage = (): Page | null => page;
export const setPage = (newPage: Page): void => { page = newPage; };
