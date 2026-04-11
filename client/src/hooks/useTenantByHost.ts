import { useQuery } from "@tanstack/react-query";
import { clientTenantHostGuess, getClientTenantApexDomain } from "@/lib/tenant-client";

export type TenantByHostApiResponse =
  | { mode: "apex"; multitenancyEnabled?: boolean; apexDomain?: string }
  | {
      mode: "tenant";
      multitenancyEnabled?: boolean;
      societyId: string;
      alphabeticId: string;
      name: string;
      acronym: string;
      shortDescription: string | null;
      logoUrl: string | null;
    };

export type TenantByHostQueryData =
  | TenantByHostApiResponse
  | { mode: "tenant_not_found"; apexDomain?: string };

async function fetchTenantByHost(): Promise<TenantByHostQueryData> {
  const res = await fetch("/api/public/tenant-by-host", { credentials: "include" });
  if (res.status === 404) {
    const body = (await res.json().catch(() => ({}))) as { apexDomain?: unknown };
    const apexDomain = typeof body.apexDomain === "string" ? body.apexDomain : undefined;
    return { mode: "tenant_not_found", apexDomain };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as TenantByHostApiResponse;
}

export function useTenantByHost() {
  const apex = getClientTenantApexDomain();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const guess = hostname ? clientTenantHostGuess(hostname) : { kind: "no_apex_config" as const };
  const likelyTenantHost = apex != null && guess.kind === "tenant";

  const query = useQuery({
    queryKey: ["/api/public/tenant-by-host"],
    queryFn: fetchTenantByHost,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    apexConfigured: apex != null,
    likelyTenantHost,
    hostGuess: guess,
  };
}
