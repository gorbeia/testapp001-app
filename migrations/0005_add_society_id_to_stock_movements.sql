-- Add society_id column to stock_movements table
ALTER TABLE stock_movements ADD COLUMN society_id TEXT NOT NULL DEFAULT (SELECT id FROM societies LIMIT 1);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_society_id_fkey FOREIGN KEY (society_id) REFERENCES societies(id);

-- Create index for better performance
CREATE INDEX idx_stock_movements_society_id ON stock_movements(society_id);
