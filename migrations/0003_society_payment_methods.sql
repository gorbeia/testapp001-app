-- Per-society payment rails (bank prepayment, cash placeholders); SEPA remains sepa_mode.
ALTER TABLE "societies" ADD COLUMN IF NOT EXISTS "payment_methods" jsonb NOT NULL DEFAULT '["bank_transfer_prepayment"]'::jsonb;
