-- Add oharrak (notes) table
CREATE TABLE IF NOT EXISTS oharrak (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT NOT NULL REFERENCES users(id),
    society_id TEXT NOT NULL REFERENCES societies(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_oharrak_society_id ON oharrak(society_id);
CREATE INDEX IF NOT EXISTS idx_oharrak_created_by ON oharrak(created_by);
CREATE INDEX IF NOT EXISTS idx_oharrak_is_active ON oharrak(is_active);
