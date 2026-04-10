import {
  productCategories,
  products,
  societies,
  tables,
  users,
} from "@shared/schema";
import type { SetupChecklistItem } from "@shared/society-setup-checklist";
import { getTenantApexDomainFromEnv } from "@shared/tenant-host";
import { and, count, eq, isNotNull } from "drizzle-orm";

import type { AppDatabase } from "../db";

function trimStr(s: string | null | undefined): string {
  return typeof s === "string" ? s.trim() : "";
}

/**
 * Computes go-live checklist flags for one society row (tenant-scoped).
 */
export async function computeSocietySetupChecklist(
  db: AppDatabase,
  society: typeof societies.$inferSelect
): Promise<SetupChecklistItem[]> {
  const societyId = society.id;

  const contactDone = trimStr(society.phone) !== "" && trimStr(society.address) !== "";
  const sepaDone =
    society.sepaMode === "disabled" ||
    (trimStr(society.iban) !== "" && trimStr(society.creditorId) !== "");

  const apexConfigured = getTenantApexDomainFromEnv() != null;
  const subdomainApplicable = apexConfigured;
  const subdomainDone = !apexConfigured || trimStr(society.subdomain) !== "";

  const [catRow, prodRow, tableRow, userRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(productCategories)
      .where(
        and(eq(productCategories.societyId, societyId), eq(productCategories.isActive, true))
      ),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.societyId, societyId), eq(products.isActive, true))),
    db
      .select({ n: count() })
      .from(tables)
      .where(
        and(
          eq(tables.societyId, societyId),
          isNotNull(tables.minCapacity),
          isNotNull(tables.maxCapacity)
        )
      ),
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.societyId, societyId), eq(users.isActive, true))),
  ]);

  const categoryDone = Number(catRow[0]?.n ?? 0) >= 1;
  const productDone = Number(prodRow[0]?.n ?? 0) >= 1;
  const tableDone = Number(tableRow[0]?.n ?? 0) >= 1;
  const membersDone = Number(userRow[0]?.n ?? 0) >= 2;

  const items: SetupChecklistItem[] = [
    { id: "contact", done: contactDone },
    { id: "sepa", done: sepaDone },
    { id: "category", done: categoryDone },
    { id: "product", done: productDone },
    { id: "table", done: tableDone },
    { id: "members", done: membersDone },
    {
      id: "subdomain",
      done: subdomainDone,
      applicable: subdomainApplicable,
    },
  ];

  return items;
}
