import { eq } from "drizzle-orm";
import { db } from "../db";
import { societyTransactionCategories } from "@shared/schema";

const DEFAULT_EXPENSES: ReadonlyArray<{ name: string; nameEs: string; sortOrder: number }> = [
  { name: "Hornidurak", nameEs: "Proveedores", sortOrder: 10 },
  { name: "Zerbitzuak", nameEs: "Servicios", sortOrder: 20 },
  { name: "Mantentze-lanak", nameEs: "Mantenimiento", sortOrder: 30 },
  { name: "Bestelakoak", nameEs: "Otros gastos", sortOrder: 40 },
];

const DEFAULT_INCOMES: ReadonlyArray<{ name: string; nameEs: string; sortOrder: number }> = [
  { name: "Bestelako sarrerak", nameEs: "Otros ingresos", sortOrder: 10 },
];

/**
 * Inserts default manual categories for a society if none exist (idempotent).
 */
export async function ensureDefaultSocietyTransactionCategories(
  societyId: string
): Promise<void> {
  const [existing] = await db
    .select({ n: societyTransactionCategories.id })
    .from(societyTransactionCategories)
    .where(eq(societyTransactionCategories.societyId, societyId))
    .limit(1);

  if (existing) return;

  const rows = [
    ...DEFAULT_EXPENSES.map((c, i) => ({
      societyId,
      name: c.name,
      nameEs: c.nameEs,
      type: "expense" as const,
      sortOrder: c.sortOrder,
    })),
    ...DEFAULT_INCOMES.map((c, i) => ({
      societyId,
      name: c.name,
      nameEs: c.nameEs,
      type: "income" as const,
      sortOrder: c.sortOrder + 100,
    })),
  ];

  await db.insert(societyTransactionCategories).values(rows);
}
