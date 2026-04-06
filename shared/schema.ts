import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
  unique,
} from "drizzle-orm/pg-core";
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

export const societies = pgTable("societies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  alphabeticId: varchar("alphabetic_id").notNull().unique(),
  name: text("name").notNull(),
  iban: text("iban"),
  creditorId: text("creditor_id"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  // Reservation pricing
  reservationPricePerMember: decimal("reservation_price_per_member", {
    precision: 10,
    scale: 2,
  }).default("25.00"),
  kitchenPricePerMember: decimal("kitchen_price_per_member", { precision: 10, scale: 2 }).default(
    "10.00"
  ),
  /** SEPA export cadence and whether the society uses automated SEPA billing. */
  sepaMode: text("sepa_mode").notNull().default("monthly"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role"),
  function: text("function"),
  phone: text("phone"),
  iban: text("iban"),
  linkedMemberId: varchar("linked_member_id"),
  linkedMemberName: text("linked_member_name"),
  subscriptionTypeId: varchar("subscription_type_id").references(() => subscriptionTypes.id),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSocietySchema = createInsertSchema(societies)
  .pick({
    alphabeticId: true,
    name: true,
    iban: true,
    creditorId: true,
    address: true,
    phone: true,
    email: true,
    reservationPricePerMember: true,
    kitchenPricePerMember: true,
    sepaMode: true,
    isActive: true,
  })
  .extend({
    sepaMode: sepaModeSchema.optional(),
  });

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  function: true,
  phone: true,
  iban: true,
  linkedMemberId: true,
  linkedMemberName: true,
  subscriptionTypeId: true,
  societyId: true,
  isActive: true,
});

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
  minStock: text("min_stock").notNull().default("0"), // Alert threshold
  supplier: text("supplier"),
  isActive: boolean("is_active").notNull().default(true),
  societyId: varchar("society_id")
    .notNull()
    .references(() => societies.id),
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

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  categoryId: true,
  price: true,
  stock: true,
  unit: true,
  minStock: true,
  supplier: true,
  isActive: true,
});

/** PATCH-style product updates; tenant is never taken from the client. */
export const updateProductSchema = insertProductSchema.partial();

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
  quantity: integer("quantity").notNull(), // Negative for consumption, positive for purchase
  reason: text("reason"),
  referenceId: varchar("reference_id"), // e.g., consumption_id, purchase_id
  previousStock: text("previous_stock").notNull(),
  newStock: text("new_stock").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"), // Reason for cancellation
  cancelledBy: varchar("cancelled_by").references(() => users.id), // User who cancelled the reservation
  cancelledAt: timestamp("cancelled_at"), // When the reservation was cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  notes: true,
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
  role: z.string().nullable(),
  function: z.string().nullable(),
  phone: z.string().nullable(),
  iban: z.string().nullable(),
  linkedMemberId: z.string().nullable(),
  linkedMemberName: z.string().nullable(),
  subscriptionTypeId: z.string().nullable(),
  societyId: z.string(),
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

export const backofficeLoginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const batchCreditStatusBodySchema = z.object({
  creditIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["pending", "paid", "partial"]),
});

export const apiCreateUserBodySchema = insertUserSchema.omit({ societyId: true });

export const updateUserProfileBodySchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().nullable().optional(),
    iban: z.string().nullable().optional(),
  })
  .refine(data => data.name !== undefined || data.phone !== undefined || data.iban !== undefined, {
    message: "At least one of name, phone, iban is required",
  });

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const updateUserAdminBodySchema = z
  .object({
    name: z.string().optional(),
    role: z.string().nullable().optional(),
    function: z.string().nullable().optional(),
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
  .omit({ userId: true, societyId: true })
  .extend({
    startDate: z.coerce.date(),
    name: z.string().min(1),
    type: z.string().min(1),
    table: z.string().min(1),
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
    iban: true,
    creditorId: true,
    address: true,
    phone: true,
    email: true,
    reservationPricePerMember: true,
    kitchenPricePerMember: true,
    sepaMode: true,
  })
  .partial()
  .extend({
    sepaMode: sepaModeSchema.optional(),
  })
  .refine(data => Object.values(data).some(v => v !== undefined), {
    message: "At least one field is required",
  });

export const backofficeCreateSocietyBodySchema = z.object({
  name: z.string().min(1),
  iban: z.string().nullish(),
  creditorId: z.string().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  reservationPricePerMember: z.union([z.string(), z.number()]).nullish(),
  kitchenPricePerMember: z.union([z.string(), z.number()]).nullish(),
  sepaMode: sepaModeSchema.nullish(),
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
