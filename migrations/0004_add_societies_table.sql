-- Create societies table
CREATE TABLE societies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    iban TEXT,
    creditor_id TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Insert default society (first row will be the active one)
INSERT INTO societies (id, name, iban, creditor_id, address, phone, email, is_active)
VALUES (
    gen_random_uuid(),
    'Gure Txokoa',
    'ES91 2100 0418 4502 0005 1330',
    'ES45000B12345678',
    'Kale Nagusia 15, 20001 Donostia',
    '+34 943 111 222',
    'info@guretxokoa.eus',
    true
);

-- Add society_id column to users table
ALTER TABLE users ADD COLUMN society_id TEXT NOT NULL DEFAULT (SELECT id FROM societies LIMIT 1);
ALTER TABLE users ADD CONSTRAINT users_society_id_fkey FOREIGN KEY (society_id) REFERENCES societies(id);

-- Add society_id column to products table
ALTER TABLE products ADD COLUMN society_id TEXT NOT NULL DEFAULT (SELECT id FROM societies LIMIT 1);
ALTER TABLE products ADD CONSTRAINT products_society_id_fkey FOREIGN KEY (society_id) REFERENCES societies(id);

-- Add society_id column to consumptions table
ALTER TABLE consumptions ADD COLUMN society_id TEXT NOT NULL DEFAULT (SELECT id FROM societies LIMIT 1);
ALTER TABLE consumptions ADD CONSTRAINT consumptions_society_id_fkey FOREIGN KEY (society_id) REFERENCES societies(id);

-- Add society_id column to reservations table
ALTER TABLE reservations ADD COLUMN society_id TEXT NOT NULL DEFAULT (SELECT id FROM societies LIMIT 1);
ALTER TABLE reservations ADD CONSTRAINT reservations_society_id_fkey FOREIGN KEY (society_id) REFERENCES societies(id);

-- Create indexes for better performance
CREATE INDEX idx_users_society_id ON users(society_id);
CREATE INDEX idx_products_society_id ON products(society_id);
CREATE INDEX idx_consumptions_society_id ON consumptions(society_id);
CREATE INDEX idx_reservations_society_id ON reservations(society_id);
