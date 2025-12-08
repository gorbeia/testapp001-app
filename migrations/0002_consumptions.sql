CREATE TABLE "consumptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"event_id" varchar,
	"type" text NOT NULL DEFAULT 'bar',
	"status" text NOT NULL DEFAULT 'open',
	"total_amount" text NOT NULL DEFAULT '0',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closed_by" varchar,
	CONSTRAINT "consumptions_user_id_users_id_fk" FOREIGN KEY("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE "consumption_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumption_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" text NOT NULL,
	"total_price" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consumption_items_consumption_id_consumptions_id_fk" FOREIGN KEY("consumption_id") REFERENCES "consumptions"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "consumption_items_product_id_products_id_fk" FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE "stock_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"reference_id" varchar,
	"previous_stock" text NOT NULL,
	"new_stock" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);
