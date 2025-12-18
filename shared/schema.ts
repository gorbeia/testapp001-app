import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const societies = pgTable("societies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alphabeticId: varchar("alphabetic_id").notNull().unique(),
  name: text("name").notNull(),
  iban: text("iban"),
  creditorId: text("creditor_id"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  // Reservation pricing
  reservationPricePerMember: decimal("reservation_price_per_member", { precision: 10, scale: 2 }).default("25.00"),
  kitchenPricePerMember: decimal("kitchen_price_per_member", { precision: 10, scale: 2 }).default("10.00"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  societyId: varchar("society_id").notNull().references(() => societies.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSocietySchema = createInsertSchema(societies).pick({
  name: true,
  iban: true,
  creditorId: true,
  address: true,
  phone: true,
  email: true,
  reservationPricePerMember: true,
  kitchenPricePerMember: true,
  isActive: true,
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  price: text("price").notNull(), // Using text for decimal precision
  stock: text("stock").notNull().default("0"), // Using text for large numbers
  unit: text("unit").notNull().default("unit"), // e.g., "unit", "kg", "liter"
  minStock: text("min_stock").notNull().default("0"), // Alert threshold
  supplier: text("supplier"),
  isActive: boolean("is_active").notNull().default(true),
  societyId: varchar("society_id").notNull().references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  category: true,
  price: true,
  stock: true,
  unit: true,
  minStock: true,
  supplier: true,
  isActive: true,
  societyId: true,
});

// Consumption sessions/events (e.g., a bar tab, event consumption)
export const consumptions = pgTable("consumptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Who made the consumption
  societyId: varchar("society_id").notNull().references(() => societies.id),
  eventId: varchar("event_id"), // Optional: linked to a reservation/event
  type: text("type").notNull().default("bar"), // "bar", "event", "kitchen"
  status: text("status").notNull().default("open"), // "open", "closed", "cancelled"
  totalAmount: text("total_amount").notNull().default("0"), // Using text for decimal precision
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by"), // User who closed the consumption
});

// Individual consumption items (products within a consumption session)
export const consumptionItems = pgTable("consumption_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  societyId: varchar("society_id").notNull().references(() => societies.id),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Who made the reservation
  societyId: varchar("society_id").notNull().references(() => societies.id),
  name: text("name").notNull(), // Event/reservation name
  type: text("type").notNull().default("event"), // "event", "meeting", "private", "other"
  status: text("status").notNull().default("confirmed"), // "pending", "confirmed", "cancelled", "completed"
  startDate: timestamp("start_date").notNull(),
  guests: integer("guests").default(0),
  useKitchen: boolean("use_kitchen").default(false),
  table: text("table").notNull(), // Table name (e.g., "Mahaia 1", "Mahaia 2", etc.)
  totalAmount: text("total_amount").notNull().default("0"), // Using text for decimal precision
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConsumptionSchema = createInsertSchema(consumptions).pick({
  userId: true,
  societyId: true,
  eventId: true,
  type: true,
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
  totalAmount: true,
  notes: true,
});

// Credits/Debts (monthly calculated debts for members)
export const credits = pgTable("credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => users.id),
  societyId: varchar("society_id").notNull().references(() => societies.id),
  month: text("month").notNull(), // Format: "YYYY-MM" (e.g., "2024-12")
  year: integer("year").notNull(),
  monthNumber: integer("month_number").notNull(), // 1-12
  consumptionAmount: decimal("consumption_amount", { precision: 10, scale: 2 }).default("0"),
  reservationAmount: decimal("reservation_amount", { precision: 10, scale: 2 }).default("0"),
  kitchenAmount: decimal("kitchen_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0"),
  status: text("status").notNull().default("pending"), // "pending", "paid", "partial"
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  markedAsPaidBy: varchar("marked_as_paid_by").references(() => users.id), // User who marked as paid
  markedAsPaidAt: timestamp("marked_as_paid_at"), // When it was marked as paid
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notifyUsers: boolean("notify_users").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  societyId: varchar("society_id").notNull().references(() => societies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Note messages for multilingual support
export const noteMessages = pgTable("note_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
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
export type Note = typeof notes.$inferSelect;
export type NoteMessage = typeof noteMessages.$inferSelect;
export type InsertNote = z.infer<typeof insertNotesSchema>;
export type InsertNoteMessage = z.infer<typeof insertNoteMessageSchema>;

// Tables for reservations
export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  minCapacity: integer("min_capacity").default(1),
  maxCapacity: integer("max_capacity").notNull(),
  description: text("description"), // Optional description of the table
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTableSchema = createInsertSchema(tables).pick({
  name: true,
  minCapacity: true,
  maxCapacity: true,
  description: true,
  isActive: true,
});

// Notifications for users
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  societyId: varchar("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
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
export type Language = 'eu' | 'es' | 'en';

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
  language: Language | 'unknown';
}

// Type guards
export const isValidLanguage = (lang: string): lang is Language => {
  return ['eu', 'es', 'en'].includes(lang);
};

export const hasMessages = (content: any): content is { messages: MultilingualMessage[] } => {
  return content && Array.isArray(content.messages) && content.messages.length > 0;
};

export const findMessageByLanguage = (
  messages: MultilingualMessage[], 
  preferredLanguage: Language
): MultilingualMessage | undefined => {
  // Try preferred language first
  let message = messages.find(msg => msg.language === preferredLanguage);
  
  // If not found, try fallback language
  if (!message) {
    const fallbackLanguage = preferredLanguage === 'eu' ? 'es' : 'eu';
    message = messages.find(msg => msg.language === fallbackLanguage);
  }
  
  // If still not found, return first available message
  if (!message && messages.length > 0) {
    message = messages[0];
  }
  
  return message;
};

export const getDisplayContent = (
  content: MultilingualContent | { messages?: MultilingualMessage[] } | { title?: string; content?: string },
  userLanguage: Language
): DisplayContent => {
  if (hasMessages(content)) {
    const message = findMessageByLanguage(content.messages, userLanguage);
    if (message) {
      return message;
    } else {
      // This should not happen with the fallback logic, but just in case
      return {
        title: 'Error',
        content: 'Content not available',
        language: 'unknown'
      };
    }
  }
  
  // Handle simple title/content format
  if ('title' in content && 'content' in content) {
    return {
      title: content.title || '',
      content: content.content || '',
      language: userLanguage
    };
  }
  
  // Default fallback
  return {
    title: '',
    content: '',
    language: 'unknown'
  };
};

// Subscription types table
export const subscriptionTypes = pgTable("subscription_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  period: text("period").notNull(), // 'monthly', 'quarterly', 'yearly', 'custom'
  periodMonths: integer("period_months").notNull().default(12), // Number of months for custom periods
  isActive: boolean("is_active").notNull().default(true),
  autoRenew: boolean("auto_renew").notNull().default(false),
  societyId: varchar("society_id").notNull().references(() => societies.id),
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
