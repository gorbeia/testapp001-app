CREATE TABLE "category_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "color" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "color" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "icon" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "icon" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "icon" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "category_messages" ADD CONSTRAINT "category_messages_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "product_categories" DROP COLUMN "description";