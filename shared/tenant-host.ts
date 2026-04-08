import { z } from "zod";

/** DNS label: lowercase alphanumerics and hyphens,1–63 chars, no leading/trailing hyphen. */
export const SOCIETY_SUBDOMAIN_LABEL_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Subdomains reserved for infrastructure or product routes (cannot be assigned to a society). */
export const RESERVED_SOCIETY_SUBDOMAIN_LABELS = new Set([
  "www",
  "api",
  "mail",
  "ftp",
  "admin",
  "elkarteapp",
  "kudeaketa",
  "app",
  "cdn",
  "static",
  "assets",
  "localhost",
]);

export function getTenantApexDomainFromEnv(): string | null {
  const raw = process.env.TENANT_APEX_DOMAIN?.trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/\.$/, "");
}

/** Strips port and lowercases (e.g. Host header). */
export function normalizeHostHeader(host: string | undefined | null): string | null {
  if (host == null || host === "") return null;
  const h = host.split(":")[0]?.trim().toLowerCase();
  return h || null;
}

export type TenantHostParseResult =
  | { kind: "apex" }
  | { kind: "tenant"; subdomain: string }
  | { kind: "no_apex_config" };

/**
 * Classifies Host for multitenancy when TENANT_APEX_DOMAIN is set (e.g. example.com).
 * Single-level tenant hosts only: {sub}.example.com */
export function parseHostForTenant(hostHeader: string | undefined | null, apexDomain: string | null): TenantHostParseResult {
  if (!apexDomain) {
    return { kind: "no_apex_config" };
  }

  const host = normalizeHostHeader(hostHeader);
  if (!host) {
    return { kind: "apex" };
  }

  const apex = apexDomain.toLowerCase();
  if (host === apex || host === `www.${apex}`) {
    return { kind: "apex" };
  }

  const suffix = `.${apex}`;
  if (!host.endsWith(suffix) || host === apex) {
    return { kind: "apex" };
  }

  const remainder = host.slice(0, -suffix.length);
  if (remainder === "" || remainder.includes(".")) {
    return { kind: "apex" };
  }

  return { kind: "tenant", subdomain: remainder };
}

export const societySubdomainFieldSchema = z
  .string()
  .transform(s => s.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "Subdomain is required")
      .max(63)
      .regex(SOCIETY_SUBDOMAIN_LABEL_REGEX, "Invalid subdomain format")
      .refine(label => !RESERVED_SOCIETY_SUBDOMAIN_LABELS.has(label), "This subdomain is reserved")
  );

/** Clears subdomain when null or ""; otherwise validates label. */
export const backofficeSocietySubdomainPatchBodySchema = z
  .object({
    subdomain: z.union([z.string(), z.null()]),
  })
  .transform(data => {
    const v = data.subdomain;
    if (v == null) return { subdomain: null as string | null };
    const t = v.trim().toLowerCase();
    return { subdomain: t === "" ? null : t };
  })
  .superRefine((data, ctx) => {
    if (data.subdomain === null) return;
    if (!SOCIETY_SUBDOMAIN_LABEL_REGEX.test(data.subdomain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid subdomain format",
        path: ["subdomain"],
      });
      return;
    }
    if (RESERVED_SOCIETY_SUBDOMAIN_LABELS.has(data.subdomain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This subdomain is reserved",
        path: ["subdomain"],
      });
    }
  });

export const backofficeCheckSubdomainQuerySchema = z.object({
  value: z.string().min(1),
  excludeId: z.string().min(1).optional(),
});
