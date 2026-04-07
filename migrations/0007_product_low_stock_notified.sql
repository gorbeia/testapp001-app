ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "low_stock_notified" boolean DEFAULT false NOT NULL;
