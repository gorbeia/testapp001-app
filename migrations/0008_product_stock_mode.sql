ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_mode" text DEFAULT 'auto' NOT NULL;
