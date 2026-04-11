import { getTenantApexDomainFromEnv } from "@shared/tenant-host";

/**
 * Base URL for absolute links in outbound mail (signup verification, password reset).
 *
 * - Prefer **`APP_PUBLIC_ORIGIN`** when set (e.g. `https://app.example.com`).
 * - In **`NODE_ENV=production`**, if unset, use **`https://{TENANT_APEX_DOMAIN}`** when
 *   multitenancy is configured so verification links match the public apex without duplicating
 *   the hostname in env.
 * - Otherwise (local dev): **`http://localhost:${PORT}`** for `pnpm dev`.
 */
export function resolvePublicOriginForMail(): string {
  const raw = process.env.APP_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (raw) return raw;

  if (process.env.NODE_ENV === "production") {
    const apex = getTenantApexDomainFromEnv();
    if (apex) {
      return `https://${apex}`;
    }
    console.warn(
      "[resolvePublicOriginForMail] NODE_ENV=production but APP_PUBLIC_ORIGIN and TENANT_APEX_DOMAIN are unset; mail links will use localhost."
    );
  }

  const port = process.env.PORT?.trim() || "5000";
  return `http://localhost:${port}`;
}
