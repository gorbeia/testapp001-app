import type { Express } from "express";

let testApp: Express | null = null;

export function setTestApp(app: Express): void {
  testApp = app;
}

export function getTestApp(): Express {
  if (!testApp) {
    throw new Error("Integration app not initialized — did BeforeAll run?");
  }
  return testApp;
}
