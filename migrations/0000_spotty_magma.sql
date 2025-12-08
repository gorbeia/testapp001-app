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
--> statement-breakpoint
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
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
