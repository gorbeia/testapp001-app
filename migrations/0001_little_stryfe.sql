CREATE TABLE "product_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6B7280',
	"icon" text DEFAULT 'Package',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"society_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "type" SET DEFAULT 'bazkaria';--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;