-- Member-balance convention: negative = charge / owes more, positive = payment in / prepaid.
-- Negates legacy debt-oriented signs on existing rows (see docs/features/account-movements.md).
UPDATE account_movements SET amount = (-1) * amount::numeric;
