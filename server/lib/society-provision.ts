import type { AppDatabase } from "../db";
import {
  categoryMessages,
  productCategories,
  tables,
  DEFAULT_RESERVATION_MEAL_TYPES,
  DEFAULT_SOCIETY_PAYMENT_METHODS,
  type SepaMode,
  type SocietyPaymentMethod,
} from "@shared/schema";
import { ensureDefaultReservationServicesForSociety } from "./reservation-services-defaults";

/**
 * Base slug for `societies.alphabetic_id` from display name (same rules as backoffice create).
 */
export function slugAlphabeticIdBaseFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20);
}

/**
 * Resolves a unique `alphabetic_id` for a new society (collision suffix `-1`, `-2`, …).
 */
export async function allocateUniqueAlphabeticId(
  dbConn: { query: AppDatabase["query"] },
  name: string
): Promise<string> {
  const base = slugAlphabeticIdBaseFromName(name);
  const alphabeticId = base || "society";
  let final = alphabeticId;
  let counter = 1;
  for (;;) {
    const existing = await dbConn.query.societies.findFirst({
      where: (s, { eq: e }) => e(s.alphabeticId, final),
    });
    if (!existing) break;
    final = `${alphabeticId}-${counter}`;
    counter += 1;
  }
  return final;
}

/** Tier 0/1 row for public self-serve signup (explicit payment + meal types for clarity). */
export function buildPublicProvisionSocietyInsertValues(input: {
  name: string;
  shortDescription: string | null;
  acronym: string;
  alphabeticId: string;
  societyEmail: string;
  phone: string | null;
  address: string | null;
  subdomain: string | null;
}) {
  return {
    name: input.name,
    shortDescription: input.shortDescription,
    acronym: input.acronym,
    alphabeticId: input.alphabeticId,
    email: input.societyEmail,
    phone: input.phone,
    address: input.address,
    subdomain: input.subdomain,
    sepaMode: "disabled" as const,
    isActive: true,
    paymentMethods: [...DEFAULT_SOCIETY_PAYMENT_METHODS] as SocietyPaymentMethod[],
    reservationMealTypes: [...DEFAULT_RESERVATION_MEAL_TYPES],
  };
}

/** Tier 0/1 row for backoffice create (preserves price / SEPA / payment method behavior). */
export function buildBackofficeProvisionSocietyInsertValues(input: {
  name: string;
  shortDescription: string | null;
  acronym: string;
  alphabeticId: string;
  iban: string | null;
  creditorId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  reservationFixedFee?: string | null;
  reservationPricePerMember: string;
  kitchenPricePerMember: string;
  sepaMode: SepaMode;
  paymentMethods?: SocietyPaymentMethod[] | null;
  isActive: boolean;
}) {
  const reservationFixedFee =
    input.reservationFixedFee != null && String(input.reservationFixedFee).trim() !== ""
      ? String(input.reservationFixedFee)
      : "0.00";
  return {
    name: input.name,
    shortDescription: input.shortDescription,
    acronym: input.acronym,
    alphabeticId: input.alphabeticId,
    iban: input.iban,
    creditorId: input.creditorId,
    address: input.address,
    phone: input.phone,
    email: input.email,
    reservationFixedFee,
    reservationPricePerMember: input.reservationPricePerMember,
    kitchenPricePerMember: input.kitchenPricePerMember,
    sepaMode: input.sepaMode,
    isActive: input.isActive,
    paymentMethods:
      input.paymentMethods !== undefined && input.paymentMethods !== null
        ? input.paymentMethods
        : ([...DEFAULT_SOCIETY_PAYMENT_METHODS] as SocietyPaymentMethod[]),
    reservationMealTypes: [...DEFAULT_RESERVATION_MEAL_TYPES],
  };
}

const BOOTSTRAP_CATEGORY = {
  color: "#64748B",
  icon: "Package",
  sortOrder: 0,
  isActive: true,
  messages: {
    eu: { name: "Orokorra", description: "Produktu orokorrak" },
    es: { name: "General", description: "Productos generales" },
  },
} as const;

/**
 * Tier 2: one product category (eu/es), one flexible reservation table, default reservation services — inside the same transaction as society creation.
 */
export async function insertTenantBootstrap(
  db: AppDatabase,
  societyId: string,
  kitchenPricePerMember?: string | null
): Promise<void> {
  const [cat] = await db
    .insert(productCategories)
    .values({
      societyId,
      color: BOOTSTRAP_CATEGORY.color,
      icon: BOOTSTRAP_CATEGORY.icon,
      sortOrder: BOOTSTRAP_CATEGORY.sortOrder,
      isActive: BOOTSTRAP_CATEGORY.isActive,
    })
    .returning();

  for (const [language, messageData] of Object.entries(BOOTSTRAP_CATEGORY.messages)) {
    await db.insert(categoryMessages).values({
      categoryId: cat.id,
      language,
      name: messageData.name,
      description: messageData.description,
    });
  }

  await db.insert(tables).values({
    societyId,
    name: "Mahaia 1",
    minCapacity: 1,
    maxCapacity: 50,
    description: null,
    isActive: true,
  });

  await ensureDefaultReservationServicesForSociety(db, societyId, kitchenPricePerMember ?? null);
}
