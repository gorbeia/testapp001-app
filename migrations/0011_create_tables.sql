CREATE TABLE IF NOT EXISTS "tables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"min_capacity" integer DEFAULT 1,
	"max_capacity" integer NOT NULL,
	"location" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tables_name_unique" UNIQUE("name")
);
