import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { getTenantApexDomainFromEnv, parseHostForTenant } from "@shared/tenant-host";

export function registerPublicTenantRoutes(app: Express) {
  app.get(
    "/api/public/tenant-by-host",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apex = getTenantApexDomainFromEnv();
        /** `false` when `TENANT_APEX_DOMAIN` is unset on this Node process (common deploy misconfig). */
        const multitenancyEnabled = apex != null;

        if (!apex) {
          return res.status(200).json({ mode: "apex" as const, multitenancyEnabled: false });
        }

        const parsed = parseHostForTenant(req.get("host"), apex);
        if (parsed.kind === "apex" || parsed.kind === "no_apex_config") {
          return res.status(200).json({ mode: "apex" as const, multitenancyEnabled: true });
        }

        const row = await db.query.societies.findFirst({
          where: (s, { eq: e }) => e(s.subdomain, parsed.subdomain),
        });

        if (!row) {
          return res.status(404).json({
            message: "Tenant not found for this host",
            apexDomain: apex,
            multitenancyEnabled: true,
          });
        }

        return res.status(200).json({
          mode: "tenant" as const,
          multitenancyEnabled: true,
          societyId: row.id,
          alphabeticId: row.alphabeticId,
          name: row.name,
          acronym: row.acronym,
          shortDescription: row.shortDescription,
          logoUrl: row.logoUrl,
        });
      } catch (err) {
        next(err);
      }
    }
  );
}
