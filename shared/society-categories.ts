import { z } from "zod";

/** Fixed manual income/expense categories for society accounting (Kontabilitatea). */
export const SOCIETY_CATEGORIES = {
  suppliers: { type: "expense" as const, sortOrder: 10 },
  services: { type: "expense" as const, sortOrder: 20 },
  maintenance: { type: "expense" as const, sortOrder: 30 },
  other_expense: { type: "expense" as const, sortOrder: 40 },
  events: { type: "income" as const, sortOrder: 50 },
  other_income: { type: "income" as const, sortOrder: 60 },
} as const;

export type SocietyCategoryKey = keyof typeof SOCIETY_CATEGORIES;

export const SOCIETY_CATEGORY_KEYS = Object.keys(SOCIETY_CATEGORIES) as SocietyCategoryKey[];

export const societyCategorySchema = z.enum([
  "suppliers",
  "services",
  "maintenance",
  "other_expense",
  "events",
  "other_income",
]);

export type SocietyCategory = z.infer<typeof societyCategorySchema>;

/** i18n keys under client `src/lib/i18n.ts` for each category (eu/es). */
export const SOCIETY_CATEGORY_I18N_KEY: Record<SocietyCategoryKey, string> = {
  suppliers: "catSuppliers",
  services: "catServices",
  maintenance: "catMaintenance",
  other_expense: "catOtherExpense",
  events: "catEvents",
  other_income: "catOtherIncome",
};

export function isSocietyCategoryKey(value: string): value is SocietyCategoryKey {
  return value in SOCIETY_CATEGORIES;
}

export function societyCategoryType(cat: SocietyCategoryKey): "income" | "expense" {
  return SOCIETY_CATEGORIES[cat].type;
}

/** Expense categories sorted for UI. */
export function societyExpenseCategories(): SocietyCategoryKey[] {
  return SOCIETY_CATEGORY_KEYS.filter(k => SOCIETY_CATEGORIES[k].type === "expense").sort(
    (a, b) => SOCIETY_CATEGORIES[a].sortOrder - SOCIETY_CATEGORIES[b].sortOrder
  );
}

/** Income categories sorted for UI. */
export function societyIncomeCategories(): SocietyCategoryKey[] {
  return SOCIETY_CATEGORY_KEYS.filter(k => SOCIETY_CATEGORIES[k].type === "income").sort(
    (a, b) => SOCIETY_CATEGORIES[a].sortOrder - SOCIETY_CATEGORIES[b].sortOrder
  );
}
