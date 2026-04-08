-- Society posted ledger: single cashbook; replaces society_transactions for manual entries.

CREATE TABLE IF NOT EXISTS society_ledger (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id VARCHAR NOT NULL REFERENCES societies(id),
  type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_id VARCHAR,
  reference_type TEXT,
  category_id VARCHAR REFERENCES society_transaction_categories(id),
  booking_date DATE NOT NULL,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  voided BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_society_ledger_society ON society_ledger(society_id);
CREATE INDEX IF NOT EXISTS idx_society_ledger_ref ON society_ledger(society_id, reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_society_ledger_manual_list ON society_ledger(society_id, is_manual, voided) WHERE is_manual = true AND voided = false;

-- Backfill derived lines from member ledger (same rules as former summary API)
INSERT INTO society_ledger (
  society_id, type, amount, description, reference_id, reference_type,
  category_id, booking_date, is_manual, voided, created_by, created_at, updated_at
)
SELECT
  m.society_id,
  CASE m.type
    WHEN 'bank_transfer' THEN 'prepayment'
    WHEN 'sepa_collection' THEN 'sepa_collection'
    WHEN 'cash_payment' THEN 'cash_payment'
    WHEN 'refund' THEN 'refund'
    WHEN 'sepa_bounce' THEN 'sepa_bounce'
  END,
  CASE
    WHEN m.type IN ('bank_transfer', 'sepa_collection', 'cash_payment') AND m.amount::numeric > 0 THEN m.amount::numeric
    WHEN m.type = 'refund' AND m.amount::numeric > 0 THEN -m.amount::numeric
    WHEN m.type = 'sepa_bounce' THEN -abs(m.amount::numeric)
    ELSE 0
  END,
  m.description,
  m.id,
  'account_movement',
  NULL,
  m.created_at::date,
  false,
  false,
  m.created_by,
  m.created_at,
  m.created_at
FROM account_movements m
WHERE (
    (m.type IN ('bank_transfer', 'sepa_collection', 'cash_payment') AND m.amount::numeric > 0)
    OR (m.type = 'refund' AND m.amount::numeric > 0)
    OR (m.type = 'sepa_bounce')
  )
  AND NOT EXISTS (
    SELECT 1 FROM society_ledger sl
    WHERE sl.reference_type = 'account_movement' AND sl.reference_id = m.id
  );

-- Preserve manual entry ids from society_transactions
INSERT INTO society_ledger (
  id, society_id, type, amount, description, reference_id, reference_type,
  category_id, booking_date, is_manual, voided, created_by, created_at, updated_at
)
SELECT
  st.id,
  st.society_id,
  CASE WHEN stc.type = 'income' THEN 'manual_income' ELSE 'manual_expense' END,
  CASE WHEN stc.type = 'income' THEN st.amount::numeric ELSE -st.amount::numeric END,
  st.description,
  st.id,
  'manual_entry',
  st.category_id,
  st.date,
  true,
  false,
  st.created_by,
  st.created_at,
  st.updated_at
FROM society_transactions st
INNER JOIN society_transaction_categories stc ON st.category_id = stc.id
WHERE NOT EXISTS (SELECT 1 FROM society_ledger sl WHERE sl.id = st.id);

DROP TABLE IF EXISTS society_transactions;
