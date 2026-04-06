-- Prepaid / saldo a favor is no longer a society-level toggle; see docs/features/account-movements.md
ALTER TABLE societies DROP COLUMN IF EXISTS allow_positive_balance;
