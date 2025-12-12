-- Initial consolidated schema migration
-- This creates the complete database schema from scratch

-- Create societies table with alphabetic_id from the start
CREATE TABLE "societies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alphabetic_id" varchar NOT NULL UNIQUE,
	"name" text NOT NULL,
	"iban" text,
	"creditor_id" text,
	"address" text,
	"phone" text,
	"email" text,
	"reservation_price_per_member" numeric(10, 2) DEFAULT '25.00',
	"kitchen_price_per_member" numeric(10, 2) DEFAULT '10.00',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create users table with society_id from the start
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text,
	"role" text,
	"function" text,
	"phone" text,
	"iban" text,
	"linked_member_id" varchar,
	"linked_member_name" text,
	"society_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);

-- Create products table with society_id from the start
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"price" text NOT NULL,
	"stock" text DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'unit' NOT NULL,
	"min_stock" text DEFAULT '0' NOT NULL,
	"supplier" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"society_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create tables table
CREATE TABLE "tables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"min_capacity" integer DEFAULT 1,
	"max_capacity" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tables_name_unique" UNIQUE("name")
);

-- Create reservations table with society_id from the start
CREATE TABLE "reservations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'event' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"start_date" timestamp NOT NULL,
	"guests" integer DEFAULT 0,
	"use_kitchen" boolean DEFAULT false,
	"table" text NOT NULL,
	"total_amount" text DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create consumptions table with society_id from the start
CREATE TABLE "consumptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"event_id" varchar,
	"type" text DEFAULT 'bar' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"total_amount" text DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closed_by" varchar
);

-- Create consumption_items table
CREATE TABLE "consumption_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumption_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" text NOT NULL,
	"total_price" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create stock_movements table with society_id from the start
CREATE TABLE "stock_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"reference_id" varchar,
	"previous_stock" text NOT NULL,
	"new_stock" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create credits table
CREATE TABLE "credits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"month" text NOT NULL,
	"year" integer NOT NULL,
	"month_number" integer NOT NULL,
	"consumption_amount" numeric(10, 2) DEFAULT '0',
	"reservation_amount" numeric(10, 2) DEFAULT '0',
	"kitchen_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"marked_as_paid_by" varchar,
	"marked_as_paid_at" timestamp,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create oharrak table with society_id from the start
CREATE TABLE "oharrak" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create chat tables
CREATE TABLE "chat_rooms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" varchar NOT NULL,
	"user2_id" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create all foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "users_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "consumptions" ADD CONSTRAINT "consumptions_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "credits" ADD CONSTRAINT "credits_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "credits" ADD CONSTRAINT "credits_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "credits" ADD CONSTRAINT "credits_marked_as_paid_by_users_id_fk" FOREIGN KEY ("marked_as_paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "oharrak" ADD CONSTRAINT "oharrak_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "oharrak" ADD CONSTRAINT "oharrak_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for better performance
CREATE INDEX "societies_alphabetic_id_idx" ON "societies"("alphabetic_id");
CREATE INDEX "users_society_id_idx" ON "users"("society_id");
CREATE INDEX "products_society_id_idx" ON "products"("society_id");
CREATE INDEX "reservations_society_id_idx" ON "reservations"("society_id");
CREATE INDEX "consumptions_society_id_idx" ON "consumptions"("society_id");
CREATE INDEX "stock_movements_society_id_idx" ON "stock_movements"("society_id");
CREATE INDEX "credits_society_id_idx" ON "credits"("society_id");
CREATE INDEX "credits_member_id_idx" ON "credits"("member_id");
CREATE INDEX "oharrak_society_id_idx" ON "oharrak"("society_id");
CREATE INDEX "chat_rooms_society_id_idx" ON "chat_rooms"("society_id");
CREATE INDEX "chat_messages_room_id_idx" ON "chat_messages"("room_id");
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");
