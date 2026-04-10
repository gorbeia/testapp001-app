import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
  unique,
  jsonb,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { accessRoleSchema, membershipTypeSchema } from "./permissions";
import { societyCategorySchema } from "./society-categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** How this society bills via SEPA / monthly credit rows (see docs/features/credits.md). */
export const sepaModeSchema = z.enum([
  "monthly",
  "bimonthly",
  "quarterly",
  "on_demand",
  "disabled",
]);
export type SepaMode = z.infer<typeof sepaModeSchema>;

/** Non-SEPA accepted payment rails (SEPA is `sepaMode` on the same table). */
export const societyPaymentMethodSchema = z.enum([
  "bank_transfer_prepayment",
  "cash_manual",
  "cash_change_machine",
]);
export type SocietyPaymentMethod = z.infer<typeof societyPaymentMethodSchema>;

export const societyPaymentMethodsSchema = z.array(societyPaymentMethodSchema);

export const DEFAULT_SOCIETY_PAYMENT_METHODS: SocietyPaymentMethod[] = ["bank_transfer_prepayment"];

/** Resolves DB/API value; null/invalid → legacy default; empty array kept when explicitly stored. */
export function normalizeSocietyPaymentMethods(raw: unknown): SocietyPaymentMethod[] {
  if (raw == null) return [...DEFAULT_SOCIETY_PAYMENT_METHODS];
  const parsed = societyPaymentMethodsSchema.safeParse(raw);
  if (!parsed.success) return [...DEFAULT_SOCIETY_PAYMENT_METHODS];
  return Array.from(new Set(parsed.data));
}

export function societyAllowsBankTransferPrepayment(raw: unknown): boolean {
  return normalizeSocietyPaymentMethods(raw).includes("bank_transfer_prepayment");
}

/** Society accepts in-person cash settlement at POS (manual or change machine). */
export function societyAllowsCashPayment(raw: unknown): boolean {
  const methods = normalizeSocietyPaymentMethods(raw);
  return methods.includes("cash_manual") || methods.includes("cash_change_machine");
}

const RESERVATION_MEAL_TYPE_ID_RE = /^[a-z0-9_-]+$/;

/** One reservation meal slot (lunch, dinner, …); `id` is stored on `reservations.type`. */
export const societyReservationMealTypeEntrySchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "id required")
      .max(64)
      .regex(RESERVATION_MEAL_TYPE_ID_RE, "id must be lowercase letters, digits, _ or -"),
    labelEu: z.string().max(80),
    labelEs: z.string().max(80),
  })
  .superRefine((data, ctx) => {
    if (!data.labelEu.trim() && !data.labelEs.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of labelEu or labelEs must be non-empty",
        path: ["labelEu"],
      });
    }
  })
  .transform(data => ({
    ...data,
    labelEu: data.labelEu.trim(),
    labelEs: data.labelEs.trim(),
  }));

export type SocietyReservationMealType = z.infer<typeof societyReservationMealTypeEntrySchema>;

export const societyReservationMealTypesSchema = z
  .array(societyReservationMealTypeEntrySchema)
  .min(1)
  .max(20)
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      const id = arr[i].id;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "id"],
          message: "Duplicate meal type id",
        });
      }
      seen.add(id);
    }
  });

/** Default meal types for new societies and when DB value is missing or invalid. */
export const DEFAULT_RESERVATION_MEAL_TYPES: SocietyReservationMealType[] = [
  { id: "bazkaria", labelEu: "Bazkaria", labelEs: "Comida" },
  { id: "afaria", labelEu: "Afaria", labelEs: "Cena" },
  { id: "askaria", labelEu: "Askaria", labelEs: "Merienda" },
  { id: "hamaiketakako", labelEu: "Hamaiketakoa", labelEs: "Hamaiketako" },
];

const reservationMealTypesJsonbDefault = sql.raw(
  `'${JSON.stringify(DEFAULT_RESERVATION_MEAL_TYPES)}'::jsonb`
);

/** Resolves DB/API value; null, invalid, or empty → default list. */
export function normalizeSocietyReservationMealTypes(raw: unknown): SocietyReservationMealType[] {
  if (raw == null) return [...DEFAULT_RESERVATION_MEAL_TYPES];
  const parsed = societyReservationMealTypesSchema.safeParse(raw);
  if (!parsed.success) return [...DEFAULT_RESERVATION_MEAL_TYPES];
  return parsed.data;
}

export type ReservationMealTypeLabelLanguage = "eu" | "es" | "en";

export function getReservationMealTypeLabel(
  types: SocietyReservationMealType[],
  id: string,
  language: ReservationMealTypeLabelLanguage
): string {
  const row = types.find(t => t.id === id);
  if (!row) return id;
  const eu = String(row.labelEu ?? "").trim();
  const es = String(row.labelEs ?? "").trim();
  if (language === "es") {
    if (es) return es;
    if (eu) return eu;
    return id;
  }
  if (language === "en") {
    if (eu) return eu;
    if (es) return es;
    return id;
  }
  if (eu) return eu;
  if (es) return es;
  return id;
}

/** Single-line label for lists, calendar, notifications. Legacy `name` wins when non-empty. */
export function formatReservationDisplayTitle(opts: {
  legacyName: string | null | undefined;
  userName: string | null | undefined;
  type: string;
  startDate: Date | string;
  mealTypes: SocietyReservationMealType[];
  language: ReservationMealTypeLabelLanguage;
}): string {
  if (opts.legacyName?.trim()) return opts.legacyName.trim();
  const meal = getReservationMealTypeLabel(opts.mealTypes, opts.type, opts.language);
  const d = opts.startDate instanceof Date ? opts.startDate : new Date(opts.startDate);
  const day =
    opts.language === "es"
      ? d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
      : d.toLocaleDateString("eu-ES", { day: "numeric", month: "short", year: "numeric" });
  const member = opts.userName?.trim() || "";
  if (member) return `${member} · ${meal} · ${day}`;
  return `${meal} · ${day}`;
}

/** Notification body line when legacy name is empty (per UI language). */
export function reservationNotificationLabel(opts: {
  legacyName: string | null | undefined;
  type: string;
  table: string;
  mealTypes: SocietyReservationMealType[];
  language: "eu" | "es" | "en";
}): string {
  if (opts.legacyName?.trim()) return opts.legacyName.trim();
  const lang: ReservationMealTypeLabelLanguage = opts.language === "es" ? "es" : "eu";
  const meal = getReservationMealTypeLabel(opts.mealTypes, opts.type, lang);
  return `${meal} · ${opts.table}`;
}

export const societies = pgTable("societies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  alphabeticId: varchar("alphabetic_id").notNull().unique(),
  name: text("name").notNull(),
  /** Optional short line under the society name in the app sidebar. */
  shortDescription: text("short_description"),
  /** Up to 3 letters for the sidebar header circle (required in UI; DB default for legacy rows). */
  acronym: varchar("acronym", { length: 3 }).notNull().default(""),
  iban: text("iban"),
  creditorId: text("creditor_id"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  // Reservation pricing
  /** Flat fee added once per reservation (before per-guest rate). */
  reservationFixedFee: decimal("reservation_fixed_fee", {
    precision: 10,
    scale: 2,
  }).default("0.00"),
  reservationPricePerMember: decimal("reservation_price_per_member", {
    precision: 10,
    scale: 2,
  }).default("25.00"),
  kitchenPricePerMember: decimal("kitchen_price_per_member", { precision: 10, scale: 2 }).default(
    "10.00"
  ),
  /** SEPA export cadence and whether the society uses automated SEPA billing. */
  sepaMode: text("sepa_mode").notNull().default("monthly"),
  /** Optional payment rails besides SEPA (bank prepayment, cash placeholders). */
  paymentMethods: jsonb("payment_methods")
    .$type<SocietyPaymentMethod[]>()
    .notNull()
    .default(sql`'["bank_transfer_prepayment"]'::jsonb`),
  /** Allowed reservation meal types (`reservations.type` must match an `id`). */
  reservationMealTypes: jsonb("reservation_meal_types")
    .$type<SocietyReservationMealType[]>()
    .notNull()
    .default(reservationMealTypesJsonbDefault),
  /**
   * When prepayment is enabled: minimum allowed sum of ledger amounts for members (same sign as balance).
   * Null = no floor. Example -50 means balance must stay >= -50€ (max 50€ debt).
   */
  prepaymentMinLedgerBalance: decimal("prepayment_min_ledger_balance", {
    precision: 10,
    scale: 2,
  }),
  /** Stored filename only (e.g. `{nanoid}.webp`); full path: `/api/images/{societyId}/{logoUrl}` */
  logoUrl: varchar("logo_url"),
  /** Floor plan / map image for reservations; same filename convention as logoUrl */
  mapImageUrl: varchar("map_image_url"),
  /**
   * DNS label for tenant host `{subdomain}.{TENANT_APEX_DOMAIN}`. Nullable; unique when set.
   */
  subdomain: varchar("subdomain", { length: 63 }).unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accessRoleEnum = pgEnum("access_role", ["admin", "treasurer", "cellarman", "member"]);

export const membershipTypeEnum = pgEnum("membership_type", ["full_member", "companion"]);

/** Locale for outbound email and future communication channels (matches notification message languages). */
export const communicationLanguageSchema = z.enum(["eu", "es", "en"]);
export type CommunicationLanguage = z.infer<typeof communicationLanguageSchema>;

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  accessRole: accessRoleEnum("access_role").notNull().default("member"),
  membershipType: membershipTypeEnum("membership_type").notNull().default("full_member"),
  phone: text("phone"),
  iban: text("iban"),
  linkedMemberId: varchar("linked_member_id"),
  linkedMemberName: text("linked_member_name"),
  subscriptionTypeId: varchar("subscription_type_id").references(() => subscriptionTypes.id),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  /** Avatar image filename under `/api/images/{societyId}/` */
  avatarUrl: varchar("avatar_url"),
  /** When true, user-targeted notifications are also sent to `username` (login email). */
  notifyEmail: boolean("notify_email").notNull().default(true),
  /** Preferred language for emails and future off-app messages. */
  communicationLanguage: varchar("communication_language", { length: 8 }).notNull().default("eu"),
  /** Product news / marketing email opt-in (self-serve and profile). */
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  /** Set when the user completes email verification (null = must verify before login). */
  emailVerifiedAt: timestamp("email_verified_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One-time email verification token for self-serve signup (row deleted after use). */
export const userEmailVerifications = pgTable(
  "user_email_verifications",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [index("user_email_verifications_token_hash_idx").on(t.tokenHash)]
);

/** One-time password reset token (row deleted after successful reset). */
export const userPasswordResets = pgTable(
  "user_password_resets",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [index("user_password_resets_token_hash_idx").on(t.tokenHash)]
);

/** Uppercase Latin letters + common Latin-1 / Latin Extended-A letters (matches deriveSocietyAcronym output). */
const SOCIETY_ACRONYM_CHARS = /^[A-Za-z\xC0-\xFF\u0100-\u017F\u0180-\u024F]+$/;

export const societyAcronymFieldSchema = z
  .string()
  .trim()
  .min(1)
  .max(3)
  .regex(SOCIETY_ACRONYM_CHARS)
  .transform(s => s.toUpperCase());

export const insertSocietySchema = createInsertSchema(societies)
  .pick({
    alphabeticId: true,
    name: true,
    shortDescription: true,
    acronym: true,
    iban: true,
    creditorId: true,
    address: true,
    phone: true,
    email: true,
    reservationFixedFee: true,
    reservationPricePerMember: true,
    kitchenPricePerMember: true,
    sepaMode: true,
    paymentMethods: true,
    isActive: true,
  })
  .extend({
    sepaMode: sepaModeSchema.optional(),
    paymentMethods: societyPaymentMethodsSchema.optional(),
    reservationMealTypes: societyReservationMealTypesSchema.optional(),
    shortDescription: z.string().max(500).nullable().optional(),
    acronym: societyAcronymFieldSchema.optional(),
  });

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  accessRole: true,
  membershipType: true,
  phone: true,
  iban: true,
  linkedMemberId: true,
  linkedMemberName: true,
  subscriptionTypeId: true,
  societyId: true,
  isActive: true,
});

/** How POS and inventory interact for this product (see docs/features/inventory.md). */
export const stockModeSchema = z.enum(["auto", "manual", "none"]);
export type StockMode = z.infer<typeof stockModeSchema>;

/** sale: POS/catalog; internal: inventory only; both: either (e.g. bulk sold whole or as parent of portions). */
export const productPurposeSchema = z.enum(["sale", "internal", "both"]);
export type ProductPurpose = z.infer<typeof productPurposeSchema>;

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id")
    .notNull()
    .references(() => productCategories.id),
  price: text("price").notNull(), // Using text for decimal precision
  stock: text("stock").notNull().default("0"), // Using text for large numbers
  unit: text("unit").notNull().default("unit"), // e.g., "unit", "kg", "liter"
  /** auto: POS decrements stock; manual: tracked via receipts/takes/adjust only; none: not inventory-tracked. */
  stockMode: text("stock_mode").notNull().default("auto"),
  minStock: text("min_stock").notNull().default("0"), // Alert threshold
  /** When true, staff were notified for low stock; reset when stock rises above minStock. */
  lowStockNotified: boolean("low_stock_notified").notNull().default(false),
  supplier: text("supplier"),
  isActive: boolean("is_active").notNull().default(true),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  /** Product photo filename under `/api/images/{societyId}/` */
  imageUrl: varchar("image_url"),
  purpose: text("purpose").notNull().default("sale"),
  /** Portion product: stock is drawn from this parent (bulk) product. */
  parentProductId: varchar("parent_product_id").references((): AnyPgColumn => products.id),
  /** Units of parent stock consumed per 1 sale of this portion (same unit as parent's `unit`). */
  parentUnitsPerSale: text("parent_units_per_sale"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Composite / recipe: ingredient lines consumed when the product is sold at POS. */
export const productRecipeLines = pgTable("product_recipe_lines", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  ingredientProductId: varchar("ingredient_product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: text("quantity").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productCategories = pgTable("product_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  color: varchar("color").notNull(),
  icon: varchar("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Category messages for multilingual support
export const categoryMessages = pgTable("category_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "cascade" }),
  language: varchar("language").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products)
  .pick({
    name: true,
    description: true,
    categoryId: true,
    price: true,
    stock: true,
    unit: true,
    minStock: true,
    supplier: true,
    isActive: true,
  })
  .extend({
    stockMode: stockModeSchema.optional(),
    purpose: productPurposeSchema.optional(),
    parentProductId: z.string().uuid().nullable().optional(),
    parentUnitsPerSale: z.string().nullable().optional(),
  });

/** PATCH-style product updates; tenant is never taken from the client. */
export const updateProductSchema = insertProductSchema.partial();

/** Catalog-only update (PUT /api/products/:id); stock changes must use POST /api/products/:id/adjust. */
export const updateProductCatalogSchema = updateProductSchema.omit({ stock: true });

/** Body for PUT /api/products/:id/recipe — replaces all recipe lines. */
export const productRecipeLineInputSchema = z.object({
  ingredientProductId: z.string().uuid(),
  quantity: z.string().min(1),
});
export const replaceProductRecipeSchema = z.object({
  lines: z.array(productRecipeLineInputSchema),
});
export type ReplaceProductRecipeInput = z.infer<typeof replaceProductRecipeSchema>;

/** Body for audited stock adjustment (cellarman/admin). */
export const stockAdjustmentSchema = z
  .object({
    type: z.enum(["adjustment", "damage"]),
    quantity: z.number().finite(),
    reason: z.string().min(1).max(500),
  })
  .superRefine((data, ctx) => {
    if (data.type === "damage" && data.quantity >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damage quantity must be negative (units removed)",
        path: ["quantity"],
      });
    }
  });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

/** Target entity for `POST /api/images/upload` (multipart field `entity`). */
export const imageUploadEntitySchema = z.enum([
  "society-logo",
  "society-map",
  "user-avatar",
  "product-image",
]);
export type ImageUploadEntity = z.infer<typeof imageUploadEntitySchema>;

/** Query params for GET /api/stock-movements */
export const stockMovementListQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  type: z.enum(["consumption", "purchase", "adjustment", "damage"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const stockReceiptLineInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.string().max(32).optional(),
});

export const createStockReceiptSchema = z.object({
  supplier: z.string().max(500).optional(),
  invoiceReference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(stockReceiptLineInputSchema).min(1),
});

export const createStockTakeSchema = z.object({
  notes: z.string().max(2000).optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

export const updateStockTakeLineSchema = z.object({
  countedStock: z.string().regex(/^\d+(\.\d+)?$/),
  notes: z.string().max(500).optional(),
});

export const paginatedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /api/stock-receipts — pagination + optional filters (month YYYY-MM, supplier/reference substring). */
export const stockReceiptListQuerySchema = paginatedQuerySchema
  .extend({
    month: z.string().optional(),
    supplier: z.string().max(200).optional(),
    reference: z.string().max(200).optional(),
  })
  .transform(val => ({
    ...val,
    month: val.month?.trim() ? val.month.trim() : undefined,
    supplier: val.supplier?.trim() ? val.supplier.trim() : undefined,
    reference: val.reference?.trim() ? val.reference.trim() : undefined,
  }))
  .superRefine((val, ctx) => {
    if (val.month && !/^\d{4}-\d{2}$/.test(val.month)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid month (expected YYYY-MM)",
        path: ["month"],
      });
    }
  });

export const insertProductCategorySchema = createInsertSchema(productCategories).pick({
  color: true,
  icon: true,
  isActive: true,
  sortOrder: true,
  societyId: true,
});

export const insertCategoryMessageSchema = createInsertSchema(categoryMessages).pick({
  categoryId: true,
  language: true,
  name: true,
  description: true,
});

// Consumption sessions/events (e.g., a bar tab, event consumption)
export const consumptions = pgTable("consumptions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Who made the consumption
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  eventId: varchar("event_id"), // Optional: linked to a reservation/event
  totalAmount: text("total_amount").notNull().default("0"), // Using text for decimal precision
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by"), // User who closed the consumption
});

// Individual consumption items (products within a consumption session)
export const consumptionItems = pgTable("consumption_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  consumptionId: varchar("consumption_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: text("unit_price").notNull(), // Price at time of consumption
  totalPrice: text("total_price").notNull(), // unitPrice * quantity
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stock movements (for tracking inventory changes)
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  type: text("type").notNull(), // "consumption", "purchase", "adjustment", "damage"
  /** Delta applied to stock (may be fractional for portions/recipes). Stored as text for precision. */
  quantity: text("quantity").notNull(),
  reason: text("reason"),
  referenceId: varchar("reference_id"), // e.g., consumption_id, purchase_id
  previousStock: text("previous_stock").notNull(),
  newStock: text("new_stock").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Incoming supply receipts (restock); each line updates stock and writes stock_movements type purchase
export const stockReceipts = pgTable("stock_receipts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  supplier: text("supplier"),
  invoiceReference: text("invoice_reference"),
  notes: text("notes"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stockReceiptLines = pgTable("stock_receipt_lines", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id")
    .notNull()
    .references(() => stockReceipts.id, { onDelete: "cascade" }),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitCost: text("unit_cost"),
});

export const stockTakeStatusEnum = pgEnum("stock_take_status", ["draft", "completed", "cancelled"]);

export const stockTakes = pgTable("stock_takes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  date: timestamp("date").notNull().defaultNow(),
  status: stockTakeStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockTakeLines = pgTable("stock_take_lines", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  stockTakeId: varchar("stock_take_id")
    .notNull()
    .references(() => stockTakes.id, { onDelete: "cascade" }),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id),
  systemStock: text("system_stock").notNull(),
  countedStock: text("counted_stock"),
  variance: text("variance"),
  notes: text("notes"),
});

/** Built-in slugs for reservation add-on services (kitchen migrated from legacy column). */
export const RESERVATION_SERVICE_SLUG_KITCHEN = "kitchen";
export const RESERVATION_SERVICE_SLUG_CLEANING = "cleaning";
export const RESERVATION_SERVICE_SLUG_HEATING = "heating";

/** Default EU/ES labels for the built-in kitchen row (server bootstrap and admin UI fallback). */
export const BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_EU = "Sukaldea";
export const BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_ES = "Cocina";

export const BUILTIN_RESERVATION_SERVICE_SLUGS = [
  RESERVATION_SERVICE_SLUG_KITCHEN,
  RESERVATION_SERVICE_SLUG_CLEANING,
  RESERVATION_SERVICE_SLUG_HEATING,
] as const;

export function isBuiltinReservationServiceSlug(slug: string): boolean {
  return (BUILTIN_RESERVATION_SERVICE_SLUGS as readonly string[]).includes(slug);
}

export const reservationServiceSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens");

/** First non-empty trimmed label (EU, then ES) — used to derive `reservation_services.slug`. */
export function reservationServiceLabelSourceForSlug(labelEu: string, labelEs: string): string {
  const eu = String(labelEu ?? "").trim();
  const es = String(labelEs ?? "").trim();
  return eu || es;
}

export type ReservationServiceDisplayLanguage = "eu" | "es" | "en";

/** User-visible label: preferred language, then the other, then internal `slug`. */
export function reservationServiceDisplayLabel(
  row: { labelEu: string; labelEs: string; slug: string },
  lang: ReservationServiceDisplayLanguage
): string {
  const eu = String(row.labelEu ?? "").trim();
  const es = String(row.labelEs ?? "").trim();
  const preferred = lang === "es" ? es : eu;
  if (preferred) return preferred;
  const fallback = lang === "es" ? eu : es;
  if (fallback) return fallback;
  return row.slug;
}

/** URL-safe slug from a label string (`reservation_services.slug`). */
export function slugifyReservationServiceLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "zerbitzua";
  const ascii = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const raw = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = raw || "zerbitzua";
  return base.length > 50 ? base.slice(0, 50) : base;
}

const RESERVATION_MEAL_TYPE_ID_FALLBACK = "mota";

/**
 * Derives a unique `id` for `allRows[forIndex]` from EU/ES labels (EU first, then ES),
 * using the same slug rules as reservation services. Collisions in the list get `-2`, `-3`, …
 */
export function allocateUniqueReservationMealTypeId(
  allRows: SocietyReservationMealType[],
  forIndex: number,
  labelEu: string,
  labelEs: string
): string {
  const source = reservationServiceLabelSourceForSlug(labelEu, labelEs);
  const baseRaw = source
    ? slugifyReservationServiceLabel(source)
    : RESERVATION_MEAL_TYPE_ID_FALLBACK;
  const base = baseRaw.length > 64 ? baseRaw.slice(0, 64) : baseRaw;
  const taken = new Set(
    allRows
      .map((r, i) => (i === forIndex ? "" : String(r.id ?? "").trim()))
      .filter(Boolean)
  );
  let candidate = base;
  let counter = 2;
  while (taken.has(candidate)) {
    const suffix = `-${counter++}`;
    candidate = (base.slice(0, Math.max(1, 64 - suffix.length)) + suffix).slice(0, 64);
  }
  return candidate;
}

export const reservationServiceSnapshotSchema = z.object({
  serviceId: z.string(),
  slug: z.string(),
  label: z.string(),
  fixedPrice: z.string(),
  pricePerMember: z.string(),
  lineTotal: z.string(),
});
export type ReservationServiceSnapshot = z.infer<typeof reservationServiceSnapshotSchema>;

/** Line charge for one service: fixed + perMember × guests (2 decimal string). */
export function computeReservationServiceLineTotal(
  fixedPrice: string | number | null | undefined,
  pricePerMember: string | number | null | undefined,
  guests: number
): string {
  const fixed =
    typeof fixedPrice === "number" ? fixedPrice : parseFloat(String(fixedPrice ?? "0")) || 0;
  const per =
    typeof pricePerMember === "number"
      ? pricePerMember
      : parseFloat(String(pricePerMember ?? "0")) || 0;
  const g = Number.isFinite(guests) && guests > 0 ? guests : 0;
  return (fixed + per * g).toFixed(2);
}

export function reservationServicePriceToDecimalString(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

/** Optional add-on services per society (cleaning, heating, kitchen, etc.). */
export const reservationServices = pgTable(
  "reservation_services",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    societyId: varchar("society_id")
      .notNull()
      .references(() => societies.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    labelEu: text("label_eu").notNull(),
    labelEs: text("label_es").notNull(),
    fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }).notNull().default("0"),
    pricePerMember: decimal("price_per_member", { precision: 10, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    /** When true, checkbox is pre-selected in the reservation dialog. */
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [unique("reservation_services_society_slug_unique").on(t.societyId, t.slug)]
);

// Reservations (events, bookings, etc.)
export const reservations = pgTable("reservations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Who made the reservation
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  name: text("name").notNull(), // Event/reservation name
  type: text("type").notNull().default("bazkaria"), // "bazkaria", "afaria", "askaria", "hamaiketakao"
  status: text("status").notNull().default("confirmed"), // "pending", "confirmed", "cancelled", "completed"
  startDate: timestamp("start_date").notNull(),
  guests: integer("guests").default(0),
  useKitchen: boolean("use_kitchen").default(false),
  table: text("table").notNull(), // Table name (e.g., "Mahaia 1", "Mahaia 2", etc.)
  totalAmount: text("total_amount").notNull().default("0"), // Using text for decimal precision
  /** Snapshot of selected add-on services and prices at booking time. */
  selectedServices: jsonb("selected_services")
    .$type<ReservationServiceSnapshot[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"), // Reason for cancellation
  cancelledBy: varchar("cancelled_by").references(() => users.id), // User who cancelled the reservation
  cancelledAt: timestamp("cancelled_at"), // When the reservation was cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Society-wide calendar entries: closures, parties, assemblies, etc. */
export const societyEventTypeSchema = z.enum([
  "closure",
  "party",
  "assembly",
  "maintenance",
  "other",
]);
export type SocietyEventType = z.infer<typeof societyEventTypeSchema>;

export const societyEvents = pgTable("society_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  type: text("type").notNull().default("other"),
  isFullDay: boolean("is_full_day").notNull().default(true),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  blocksAllReservations: boolean("blocks_all_reservations").notNull().default(false),
  blocksKitchen: boolean("blocks_kitchen").notNull().default(false),
  blockedTableIds: jsonb("blocked_table_ids")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSocietyEventSchema = createInsertSchema(societyEvents).pick({
  title: true,
  type: true,
  isFullDay: true,
  startDate: true,
  endDate: true,
  blocksAllReservations: true,
  blocksKitchen: true,
  blockedTableIds: true,
  notes: true,
});

export const createSocietyEventBodySchema = insertSocietyEventSchema
  .extend({
    type: societyEventTypeSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    blockedTableIds: z.array(z.string().min(1)).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
  });

export const updateSocietyEventBodySchema = insertSocietyEventSchema
  .partial()
  .extend({
    type: societyEventTypeSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    blockedTableIds: z.array(z.string().min(1)).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.startDate !== undefined &&
      data.endDate !== undefined &&
      data.endDate < data.startDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
  });

export const insertConsumptionSchema = createInsertSchema(consumptions).pick({
  userId: true,
  societyId: true,
  eventId: true,
  notes: true,
});

export const insertConsumptionItemSchema = createInsertSchema(consumptionItems).pick({
  consumptionId: true,
  productId: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  notes: true,
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).pick({
  productId: true,
  societyId: true,
  type: true,
  quantity: true,
  reason: true,
  referenceId: true,
  previousStock: true,
  newStock: true,
  createdBy: true,
});

export const insertReservationSchema = createInsertSchema(reservations).pick({
  userId: true,
  societyId: true,
  name: true,
  type: true,
  startDate: true,
  guests: true,
  useKitchen: true,
  table: true,
  totalAmount: true,
  selectedServices: true,
  notes: true,
});

export type ReservationService = typeof reservationServices.$inferSelect;

export const insertReservationServiceSchema = createInsertSchema(reservationServices).pick({
  societyId: true,
  slug: true,
  labelEu: true,
  labelEs: true,
  fixedPrice: true,
  pricePerMember: true,
  isActive: true,
  isDefault: true,
  sortOrder: true,
});

export const createReservationServiceBodySchema = insertReservationServiceSchema
  .omit({ societyId: true, slug: true })
  .extend({
    labelEu: z.string().max(200),
    labelEs: z.string().max(200),
    fixedPrice: z.union([z.string(), z.number()]).optional(),
    pricePerMember: z.union([z.string(), z.number()]).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (!reservationServiceLabelSourceForSlug(data.labelEu, data.labelEs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of labelEu or labelEs must be non-empty",
        path: ["labelEu"],
      });
    }
    const fixed =
      data.fixedPrice === undefined
        ? 0
        : typeof data.fixedPrice === "number"
          ? data.fixedPrice
          : parseFloat(String(data.fixedPrice));
    const per =
      data.pricePerMember === undefined
        ? 0
        : typeof data.pricePerMember === "number"
          ? data.pricePerMember
          : parseFloat(String(data.pricePerMember));
    if (
      Number.isNaN(fixed) ||
      Number.isNaN(per) ||
      fixed < 0 ||
      per < 0 ||
      (fixed === 0 && per === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of fixedPrice or pricePerMember must be positive",
        path: ["fixedPrice"],
      });
    }
  });

export const updateReservationServiceBodySchema = z
  .object({
    labelEu: z.string().max(200).optional(),
    labelEs: z.string().max(200).optional(),
    fixedPrice: z.union([z.string(), z.number()]).optional(),
    pricePerMember: z.union([z.string(), z.number()]).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine(data => Object.values(data).some(v => v !== undefined), {
    message: "At least one field is required",
  })
  .superRefine((data, ctx) => {
    if (data.fixedPrice === undefined && data.pricePerMember === undefined) return;
    const fixed =
      data.fixedPrice === undefined
        ? undefined
        : typeof data.fixedPrice === "number"
          ? data.fixedPrice
          : parseFloat(String(data.fixedPrice));
    const per =
      data.pricePerMember === undefined
        ? undefined
        : typeof data.pricePerMember === "number"
          ? data.pricePerMember
          : parseFloat(String(data.pricePerMember));
    if (fixed !== undefined && (Number.isNaN(fixed) || fixed < 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid fixedPrice", path: ["fixedPrice"] });
    }
    if (per !== undefined && (Number.isNaN(per) || per < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid pricePerMember",
        path: ["pricePerMember"],
      });
    }
  });

// Superadmins table for backoffice multisociety admin access
export const superadmins = pgTable("superadmins", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(), // Hashed password
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSuperadminSchema = createInsertSchema(superadmins).pick({
  email: true,
  password: true,
  name: true,
  isActive: true,
});

// Credits/Debts (monthly calculated debts for members)
export const credits = pgTable("credits", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  memberId: varchar("member_id")
    .notNull()
    .references(() => users.id),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  month: text("month").notNull(), // Format: "YYYY-MM" (e.g., "2024-12")
  year: integer("year").notNull(),
  monthNumber: integer("month_number").notNull(), // 1-12
  consumptionAmount: decimal("consumption_amount", { precision: 10, scale: 2 }).default("0"),
  reservationAmount: decimal("reservation_amount", { precision: 10, scale: 2 }).default("0"),
  subscriptionAmount: decimal("subscription_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0"),
  status: text("status").notNull().default("pending"), // "pending", "paid", "partial"
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  markedAsPaidBy: varchar("marked_as_paid_by").references(() => users.id), // User who marked as paid
  markedAsPaidAt: timestamp("marked_as_paid_at"), // When it was marked as paid
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accountMovementTypeSchema = z.enum([
  "consumption",
  "reservation",
  "subscription",
  "sepa_collection",
  "sepa_bounce",
  "bank_transfer",
  "refund",
  "adjustment",
  "cash_payment",
]);

export type AccountMovementType = z.infer<typeof accountMovementTypeSchema>;

export const accountMovements = pgTable("account_movements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: varchar("reference_id"),
  referenceType: text("reference_type"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bankTransferStatusSchema = z.enum(["pending", "validated", "rejected"]);

export const bankTransfers = pgTable("bank_transfers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  transferDate: date("transfer_date").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  validatedBy: varchar("validated_by").references(() => users.id),
  validatedAt: timestamp("validated_at"),
  rejectionReason: text("rejection_reason"),
  movementId: varchar("movement_id").references(() => accountMovements.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Filter manual society entries by income vs expense (Kontabilitatea). */
export const societyTransactionCategoryTypeSchema = z.enum(["income", "expense"]);
export type SocietyTransactionCategoryType = z.infer<typeof societyTransactionCategoryTypeSchema>;

/** Posted society cashbook: derived member-ledger mirror + manual entries + adjustments (append-only). */
export const societyLedgerTypeSchema = z.enum([
  "prepayment",
  "sepa_collection",
  "cash_payment",
  "refund",
  "sepa_bounce",
  "manual_income",
  "manual_expense",
  "manual_adjustment",
]);
export type SocietyLedgerType = z.infer<typeof societyLedgerTypeSchema>;

export const societyLedger = pgTable("society_ledger", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: varchar("reference_id"),
  referenceType: text("reference_type"),
  /** Fixed society accounting category key (`shared/society-categories.ts`); null for mirrored member lines. */
  category: varchar("category"),
  bookingDate: date("booking_date").notNull(),
  isManual: boolean("is_manual").notNull().default(false),
  voided: boolean("voided").notNull().default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const societyTransactionBodySchema = z.object({
  category: societyCategorySchema,
  date: z.coerce.date(),
  amount: z.union([z.coerce.number().positive(), z.string()]),
  description: z.string().optional(),
});

export const societyTransactionUpdateBodySchema = z.object({
  category: societyCategorySchema.optional(),
  date: z.coerce.date().optional(),
  amount: z.union([z.coerce.number().positive(), z.string()]).optional(),
  description: z.string().optional(),
});

export const societyAccountingSummaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}$/),
});

export type SocietyLedger = typeof societyLedger.$inferSelect;

export const insertAccountMovementSchema = createInsertSchema(accountMovements).pick({
  societyId: true,
  userId: true,
  type: true,
  amount: true,
  description: true,
  referenceId: true,
  referenceType: true,
  createdBy: true,
});

export const insertBankTransferSchema = createInsertSchema(bankTransfers).pick({
  societyId: true,
  userId: true,
  amount: true,
  transferDate: true,
  reference: true,
  notes: true,
  status: true,
});

export const accountMovementRefundBodySchema = z.object({
  userId: z.string().min(1),
  amount: z.union([z.coerce.number().positive(), z.string()]),
  description: z.string().min(1),
});

export const accountMovementSepaBounceBodySchema = z.object({
  creditId: z.string().min(1),
});

/** YYYY-MM */
export const creditMonthLabelSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const cashSettlementBodySchema = z
  .object({
    reservationIds: z.array(z.string().min(1)).optional(),
    subscriptionMonths: z.array(creditMonthLabelSchema).optional(),
  })
  .superRefine((val, ctx) => {
    const n = (val.reservationIds?.length ?? 0) + (val.subscriptionMonths?.length ?? 0);
    if (n === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one reservationIds or subscriptionMonths entry is required",
      });
    }
  });

export type CashSettlementBody = z.infer<typeof cashSettlementBodySchema>;

/** `account_movements.reference_type` for idempotent cash settlement rows */
export const ACCOUNT_MOVEMENT_REF_RESERVATION_CASH = "reservation_cash";
/** Reversal of cash settlement when reservation is cancelled (idempotent per reservation id) */
export const ACCOUNT_MOVEMENT_REF_RESERVATION_CASH_CANCEL = "reservation_cash_cancel";
export const ACCOUNT_MOVEMENT_REF_SUBSCRIPTION_CASH = "subscription_cash";

export const bankTransferCreateBodySchema = z.object({
  userId: z.string().min(1),
  amount: z.union([z.coerce.number().positive(), z.string()]),
  transferDate: z.coerce.date(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const bankTransferMemberProposalBodySchema = bankTransferCreateBodySchema.omit({
  userId: true,
});

export const bankTransferRejectBodySchema = z.object({
  rejectionReason: z.string().min(1),
});

export const notes = pgTable("notes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  notifyUsers: boolean("notify_users").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Note messages for multilingual support
export const noteMessages = pgTable("note_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  noteId: varchar("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  language: varchar("language").notNull(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotesSchema = createInsertSchema(notes).pick({
  notifyUsers: true,
  isActive: true,
  createdBy: true,
  societyId: true,
});

export const insertNoteMessageSchema = createInsertSchema(noteMessages).pick({
  noteId: true,
  language: true,
  title: true,
  content: true,
});

export type InsertSociety = z.infer<typeof insertSocietySchema>;
export type Society = typeof societies.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/** Access-token payload: same fields as `User` except `password`; dates may be ISO strings after JWT encode/decode. */
export const jwtUserPayloadSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  accessRole: accessRoleSchema,
  membershipType: membershipTypeSchema,
  phone: z.string().nullable(),
  iban: z.string().nullable(),
  linkedMemberId: z.string().nullable(),
  linkedMemberName: z.string().nullable(),
  subscriptionTypeId: z.string().nullable(),
  societyId: z.string(),
  avatarUrl: z.string().nullish(),
  notifyEmail: z.boolean().default(true),
  communicationLanguage: communicationLanguageSchema.default("eu"),
  /** Omitted on legacy tokens issued before this field existed. */
  marketingOptIn: z.boolean().optional(),
  /** Omitted on legacy tokens; login still enforced using DB row. */
  emailVerifiedAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type JwtSessionUser = z.infer<typeof jwtUserPayloadSchema>;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertConsumption = z.infer<typeof insertConsumptionSchema>;
export type Consumption = typeof consumptions.$inferSelect;
export type InsertConsumptionItem = z.infer<typeof insertConsumptionItemSchema>;
export type ConsumptionItem = typeof consumptionItems.$inferSelect;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;
export type SocietyEvent = typeof societyEvents.$inferSelect;
export type Credit = typeof credits.$inferSelect;
export type InsertCredit = typeof credits.$inferSelect;
export type AccountMovement = typeof accountMovements.$inferSelect;
export type BankTransfer = typeof bankTransfers.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NoteMessage = typeof noteMessages.$inferSelect;
export type InsertNote = z.infer<typeof insertNotesSchema>;
export type InsertNoteMessage = z.infer<typeof insertNoteMessageSchema>;

// Tables for reservations (tenant-scoped; name unique per society)
export const tables = pgTable(
  "tables",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    societyId: varchar("society_id")
      .notNull()
      .references(() => societies.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    minCapacity: integer("min_capacity").default(1),
    maxCapacity: integer("max_capacity").notNull(),
    description: text("description"), // Optional description of the table
    /** When true, multiple reservations can share capacity up to maxCapacity for the same slot. */
    allowsPartialReservation: boolean("allows_partial_reservation").notNull().default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [unique("tables_society_id_name_unique").on(t.societyId, t.name)]
);

export const insertTableSchema = createInsertSchema(tables).pick({
  name: true,
  minCapacity: true,
  maxCapacity: true,
  description: true,
  allowsPartialReservation: true,
  isActive: true,
});

export const updateTableSchema = insertTableSchema
  .partial()
  .refine(data => Object.values(data).some(v => v !== undefined), {
    message: "At least one field is required",
  });

// Notifications for users
export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id, { onDelete: "cascade" }),
  referenceId: varchar("reference_id"), // Reference to the original entity (note_id, debt_id, etc.)
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  defaultLanguage: varchar("default_language").notNull().default("eu"),
});

// Notification messages for multilingual support
export const notificationMessages = pgTable("notification_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id")
    .notNull()
    .references(() => notifications.id, { onDelete: "cascade" }),
  language: varchar("language").notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  societyId: true,
  title: true,
  message: true,
  isRead: true,
});

export const insertNotificationMessageSchema = createInsertSchema(notificationMessages).pick({
  notificationId: true,
  language: true,
  title: true,
  message: true,
});

export type Table = typeof tables.$inferSelect;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationMessage = typeof notificationMessages.$inferSelect;
export type InsertNotificationMessage = z.infer<typeof insertNotificationMessageSchema>;

// Shared types for multilingual content handling
export type Language = "eu" | "es" | "en";

export interface MultilingualMessage {
  language: Language;
  title: string;
  content: string;
}

export interface MultilingualContent {
  messages: MultilingualMessage[];
  defaultLanguage: Language;
}

export interface DisplayContent {
  title: string;
  content: string;
  language: Language | "unknown";
}

// Type guards
export const isValidLanguage = (lang: string): lang is Language => {
  return ["eu", "es", "en"].includes(lang);
};

export const hasMessages = (content: unknown): content is { messages: MultilingualMessage[] } => {
  if (content === null || typeof content !== "object") return false;
  const messages = (content as { messages?: unknown }).messages;
  return Array.isArray(messages) && messages.length > 0;
};

export const findMessageByLanguage = (
  messages: MultilingualMessage[],
  preferredLanguage: Language
): MultilingualMessage | undefined => {
  // Try preferred language first
  let message = messages.find(msg => msg.language === preferredLanguage);

  // If not found, try fallback language
  if (!message) {
    const fallbackLanguage = preferredLanguage === "eu" ? "es" : "eu";
    message = messages.find(msg => msg.language === fallbackLanguage);
  }

  // If still not found, return first available message
  if (!message && messages.length > 0) {
    message = messages[0];
  }

  return message;
};

export const getDisplayContent = (
  content:
    | MultilingualContent
    | { messages?: MultilingualMessage[] }
    | { title?: string; content?: string },
  userLanguage: Language
): DisplayContent => {
  if (hasMessages(content)) {
    const message = findMessageByLanguage(content.messages, userLanguage);
    if (message) {
      return message;
    } else {
      // This should not happen with the fallback logic, but just in case
      return {
        title: "Error",
        content: "Content not available",
        language: "unknown",
      };
    }
  }

  // Handle simple title/content format
  if ("title" in content && "content" in content) {
    return {
      title: content.title || "",
      content: content.content || "",
      language: userLanguage,
    };
  }

  // Default fallback
  return {
    title: "",
    content: "",
    language: "unknown",
  };
};

// Subscription types table
export const subscriptionTypes = pgTable("subscription_types", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  period: text("period").notNull(), // 'monthly', 'quarterly', 'yearly', 'custom'
  periodMonths: integer("period_months").notNull().default(12), // Number of months for custom periods
  isActive: boolean("is_active").notNull().default(true),
  autoRenew: boolean("auto_renew").notNull().default(false),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionTypeSchema = createInsertSchema(subscriptionTypes).pick({
  name: true,
  description: true,
  amount: true,
  period: true,
  periodMonths: true,
  isActive: true,
  autoRenew: true,
});

export type SubscriptionType = typeof subscriptionTypes.$inferSelect;
export type InsertSubscriptionType = typeof subscriptionTypes.$inferInsert;

// --- HTTP API body validation (Zod) ---

export const loginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  societyId: z.string().min(1),
});

/** Forgot password: societyId required on apex; optional on tenant host (society from Host). */
export const publicForgotPasswordBodySchema = z.object({
  email: z.string().email(),
  societyId: z.string().min(1).optional(),
});

export const publicResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

export const backofficeLoginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const backofficeEmailTestBodySchema = z.object({
  to: z.string().email(),
});

export const batchCreditStatusBodySchema = z.object({
  creditIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["pending", "paid", "partial"]),
});

export const apiCreateUserBodySchema = insertUserSchema
  .omit({ societyId: true, accessRole: true, membershipType: true })
  .extend({
    accessRole: accessRoleSchema.optional(),
    membershipType: membershipTypeSchema.optional(),
  });

export const updateUserProfileBodySchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().nullable().optional(),
    iban: z.string().nullable().optional(),
    notifyEmail: z.boolean().optional(),
    communicationLanguage: communicationLanguageSchema.optional(),
  })
  .refine(
    data =>
      data.name !== undefined ||
      data.phone !== undefined ||
      data.iban !== undefined ||
      data.notifyEmail !== undefined ||
      data.communicationLanguage !== undefined,
    {
      message: "At least one of name, phone, iban, notifyEmail, communicationLanguage is required",
    }
  );

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const updateUserAdminBodySchema = z
  .object({
    name: z.string().optional(),
    membershipType: membershipTypeSchema.optional(),
    accessRole: accessRoleSchema.optional(),
    phone: z.string().nullable().optional(),
    iban: z.string().nullable().optional(),
    linkedMemberId: z.string().nullable().optional(),
    linkedMemberName: z.string().nullable().optional(),
    subscriptionTypeId: z.string().nullable().optional(),
  })
  .refine(data => Object.values(data).some(v => v !== undefined), {
    message: "At least one field is required",
  });

const subscriptionPeriodSchema = z.enum(["monthly", "quarterly", "yearly", "custom"]);

const subscriptionTypeFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  amount: z.union([z.coerce.number(), z.string()]),
  period: subscriptionPeriodSchema,
  periodMonths: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  autoRenew: z.boolean().optional(),
});

export const subscriptionTypeCreateBodySchema = subscriptionTypeFieldsSchema.superRefine(
  (data, ctx) => {
    const raw = typeof data.amount === "number" ? data.amount : parseFloat(String(data.amount));
    if (Number.isNaN(raw) || raw < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
    }
    if (data.period === "custom" && (!data.periodMonths || data.periodMonths < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "periodMonths is required and must be at least 1 for custom periods",
      });
    }
  }
);

export const subscriptionTypeUpdateBodySchema = subscriptionTypeFieldsSchema
  .partial()
  .superRefine((data, ctx) => {
    if (!Object.values(data).some(v => v !== undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one field is required" });
    }
    if (data.period === "custom" && data.periodMonths !== undefined && data.periodMonths < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid periodMonths" });
    }
    if (data.amount !== undefined) {
      const raw = typeof data.amount === "number" ? data.amount : parseFloat(String(data.amount));
      if (Number.isNaN(raw) || raw < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
      }
    }
  });

export const createReservationBodySchema = insertReservationSchema
  .omit({ userId: true, societyId: true, useKitchen: true, totalAmount: true, selectedServices: true })
  .extend({
    startDate: z.coerce.date(),
    /** Optional; UI no longer collects it — stored empty when omitted. */
    name: z
      .string()
      .optional()
      .transform(s => (s == null ? "" : String(s).trim())),
    type: z.string().min(1),
    table: z.string().min(1),
    /** Add-on service row IDs; server resolves prices and sets totalAmount, selectedServices, useKitchen. */
    selectedServiceIds: z.array(z.string().min(1)).optional().default([]),
  });

export const cancelReservationBodySchema = z.object({
  cancellationReason: z.string().optional(),
});

export const apiConsumptionCreateBodySchema = insertConsumptionSchema.omit({
  userId: true,
  societyId: true,
});

export const addConsumptionItemsBodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        notes: z.string().nullish(),
      })
    )
    .min(1),
});

export const noteMessageBodySchema = z.object({
  language: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const createNoteBodySchema = z.object({
  messages: z.array(noteMessageBodySchema).min(1),
});

export const updateNoteBodySchema = z
  .object({
    messages: z.array(noteMessageBodySchema).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(data => data.messages !== undefined || data.isActive !== undefined, {
    message: "At least one of messages, isActive is required",
  });

export const noteNotifyBodySchema = z.object({
  notifyUsers: z.boolean(),
});

export const createNotificationBodySchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
    targetUserId: z.string().optional(),
    defaultLanguage: z.enum(["eu", "es", "en"]).optional(),
    messages: z
      .record(
        z.string(),
        z.object({
          title: z.string().optional(),
          message: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    data =>
      Boolean(
        (data.title != null && data.title !== "") || (data.message != null && data.message !== "")
      ) ||
      (data.messages != null && Object.keys(data.messages).length > 0),
    { message: "title/message or messages is required" }
  );

export const updateSocietySettingsBodySchema = insertSocietySchema
  .pick({
    name: true,
    shortDescription: true,
    acronym: true,
    iban: true,
    creditorId: true,
    address: true,
    phone: true,
    email: true,
    reservationFixedFee: true,
    reservationPricePerMember: true,
    kitchenPricePerMember: true,
    sepaMode: true,
    paymentMethods: true,
  })
  .partial()
  .extend({
    sepaMode: sepaModeSchema.optional(),
    paymentMethods: societyPaymentMethodsSchema.optional(),
    reservationMealTypes: societyReservationMealTypesSchema.optional(),
    prepaymentMinLedgerBalance: z.union([z.string(), z.number()]).nullable().optional(),
    shortDescription: z.union([z.string().max(500), z.null()]).optional(),
    acronym: societyAcronymFieldSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.name !== undefined && data.name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Society name is required",
      });
    }
    if (data.shortDescription !== undefined && data.shortDescription !== null) {
      if (data.shortDescription.length > 500) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shortDescription"],
          message: "Too long",
        });
      }
    }
  })
  .refine(data => Object.values(data).some(v => v !== undefined), {
    message: "At least one field is required",
  });

/** Public self-serve signup (landing); subdomain validated server-side when multitenancy is enabled. */
export const publicSocietySignupBodySchema = z.object({
  societyName: z.string().trim().min(1).max(200),
  shortDescription: z.string().trim().max(500).optional(),
  acronym: societyAcronymFieldSchema.optional(),
  societyContactEmail: z.string().email().optional(),
  societyPhone: z.string().trim().max(80).optional(),
  societyAddress: z.string().trim().max(500).optional(),
  /** DNS label; required at runtime when `TENANT_APEX_DOMAIN` is set. */
  subdomain: z.string().optional(),
  adminName: z.string().trim().min(1).max(200),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
  /** When true, the user agrees to receive product news and updates (opt-in). */
  marketingOptIn: z.boolean(),
  acceptTerms: z.literal(true),
  communicationLanguage: communicationLanguageSchema.optional(),
});

export const publicVerifyEmailQuerySchema = z.object({
  token: z.string().min(1),
});

export const backofficeCreateSocietyBodySchema = z.object({
  name: z.string().min(1),
  shortDescription: z.union([z.string().max(500), z.null()]).optional(),
  acronym: societyAcronymFieldSchema.optional(),
  iban: z.string().nullish(),
  creditorId: z.string().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  reservationFixedFee: z.union([z.string(), z.number()]).nullish(),
  reservationPricePerMember: z.union([z.string(), z.number()]).nullish(),
  kitchenPricePerMember: z.union([z.string(), z.number()]).nullish(),
  sepaMode: sepaModeSchema.nullish(),
  paymentMethods: societyPaymentMethodsSchema.nullish(),
  prepaymentMinLedgerBalance: z.union([z.string(), z.number()]).nullish(),
});

export const createSuperadminBodySchema = insertSuperadminSchema;

export const updateSuperadminBodySchema = z
  .object({
    email: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    password: z.string().optional(),
  })
  .refine(
    data =>
      data.email !== undefined ||
      data.name !== undefined ||
      data.isActive !== undefined ||
      (data.password !== undefined && data.password.length > 0),
    { message: "At least one field is required" }
  );

export const createCategoryBodySchema = insertProductCategorySchema
  .omit({ societyId: true })
  .extend({
    messages: z
      .record(
        z.string(),
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
        })
      )
      .optional(),
  });

export const updateCategoryBodySchema = createCategoryBodySchema
  .partial()
  .refine(data => Object.values(data).some(v => v !== undefined), {
    message: "At least one field is required",
  });

export const reorderCategoriesBodySchema = z.object({
  categoryIds: z.array(z.string().min(1)).min(1),
});
