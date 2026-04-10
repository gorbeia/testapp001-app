/**
 * Base URL for absolute links in outbound mail (signup verification, password reset).
 *
 * - Production / staging: set **`APP_PUBLIC_ORIGIN`** (e.g. `https://app.example.com`).
 * - Local dev: defaults to **`http://localhost:${PORT}`** so links match `pnpm dev` (Express + Vite middleware, default port 5000). The old **`localhost:5173`** default only applied when the client ran a separate Vite process.
 */
export function resolvePublicOriginForMail(): string {
  const raw = process.env.APP_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (raw) return raw;
  const port = process.env.PORT?.trim() || "5000";
  return `http://localhost:${port}`;
}
