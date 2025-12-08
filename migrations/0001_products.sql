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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
