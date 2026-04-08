-- Replace society_transaction_categories FK with fixed enum keys on society_ledger.
-- FK must be dropped before UPDATEs: category_id changes from UUID to enum string keys.

-- Drop FK to society_transaction_categories (name varies by Postgres version).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'society_ledger'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%society_transaction_categories%'
  ) LOOP
    EXECUTE format('ALTER TABLE society_ledger DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Map UUID category_id values to enum keys using legacy name patterns.
UPDATE society_ledger sl
SET category_id = CASE
  WHEN stc.name ILIKE '%hornidurak%' OR COALESCE(stc.name_es, '') ILIKE '%proveedor%' THEN 'suppliers'
  WHEN stc.name ILIKE '%zerbitzuak%' OR COALESCE(stc.name_es, '') ILIKE '%servicio%' THEN 'services'
  WHEN stc.name ILIKE '%mantentze%' OR COALESCE(stc.name_es, '') ILIKE '%mantenimiento%' THEN 'maintenance'
  WHEN stc.name ILIKE '%bestelako%' AND stc.type = 'income'
    OR COALESCE(stc.name_es, '') ILIKE '%otros ingresos%' THEN 'other_income'
  WHEN stc.name ILIKE '%ekitaldi%' OR COALESCE(stc.name_es, '') ILIKE '%evento%' THEN 'events'
  WHEN stc.type = 'income' THEN 'other_income'
  ELSE 'other_expense'
END
FROM society_transaction_categories stc
WHERE sl.category_id = stc.id;

-- Any remaining non-enum values (orphaned UUIDs): coerce by ledger line type.
UPDATE society_ledger sl
SET category_id = CASE
  WHEN sl.type = 'manual_income' THEN 'other_income'
  ELSE 'other_expense'
END
WHERE sl.category_id IS NOT NULL
  AND sl.category_id NOT IN (
    'suppliers',
    'services',
    'maintenance',
    'other_expense',
    'events',
    'other_income'
  );

ALTER TABLE society_ledger RENAME COLUMN category_id TO category;

DROP TABLE IF EXISTS society_transaction_categories;
