-- Per-society SEPA billing cadence (see docs/features/credits.md).
ALTER TABLE "societies" ADD COLUMN IF NOT EXISTS "sepa_mode" text DEFAULT 'monthly' NOT NULL;
