import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const stepsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(stepsDir, "../..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(repoRoot, ".env.local"), quiet: true, override: true });

/**
 * Resolve SPA origin for Playwright. Order:
 * 1. E2E_BASE_URL
 * 2. VITE_API_URL (same origin as the dev API in this repo)
 * 3. http://localhost:${PORT} — PORT from .env (defaults to 5000)
 */
function resolveE2eBaseUrl(): string {
  const explicit = process.env.E2E_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const vite = process.env.VITE_API_URL?.trim();
  if (vite && /^https?:\/\//i.test(vite)) {
    return vite;
  }

  const port = process.env.PORT?.trim() || "5000";
  return `http://localhost:${port}`;
}

const raw = resolveE2eBaseUrl().trim();
export const E2E_BASE_URL = raw.replace(/\/$/, "");

/** Full URL for a path (e.g. `/zorrak` → `http://localhost:5001/zorrak`). */
export function e2eUrl(pathSuffix: string): string {
  const p = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
  return `${E2E_BASE_URL}${p}`;
}
