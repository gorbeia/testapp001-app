import { useQuery } from "@tanstack/react-query";
import { clientTenantHostGuess, getClientTenantApexDomain } from "@/lib/tenant-client";

export type TenantByHostApiResponse =
  | { mode: "apex" }
  | {
      mode: "tenant";
      societyId: string;
      alphabeticId: string;
      name: string;
      acronym: string;
      shortDescription: string | null;
      logoUrl: string | null;
    };

export type TenantByHostQueryData =
  | TenantByHostApiResponse
  | { mode: "tenant_not_found" };

async function fetchTenantByHost(): Promise<TenantByHostQueryData> {
  const res = await fetch("/api/public/tenant-by-host", { credentials: "include" });
  if (res.status === 404) {
    return { mode: "tenant_not_found" };
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
