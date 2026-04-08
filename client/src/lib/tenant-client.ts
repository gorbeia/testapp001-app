import { parseHostForTenant, type TenantHostParseResult } from "@shared/tenant-host";

export function getClientTenantApexDomain(): string | null {
  const v = import.meta.env.VITE_TENANT_APEX_DOMAIN as string | undefined;
  if (v == null || v.trim() === "") return null;
  return v.trim().toLowerCase().replace(/\.$/, "");
}

export function clientTenantHostGuess(hostname: string): TenantHostParseResult {
  return parseHostForTenant(hostname, getClientTenantApexDomain());
}
