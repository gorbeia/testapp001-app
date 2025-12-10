import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const societies = pgTable("societies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  societyId: varchar("society_id").notNull().references(() => societies.id),
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
