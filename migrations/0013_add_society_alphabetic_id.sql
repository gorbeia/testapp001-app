-- Add alphabetic_id column to societies table
ALTER TABLE societies ADD COLUMN alphabetic_id VARCHAR NOT NULL UNIQUE;

-- Create a unique index on alphabetic_id for faster lookups
CREATE UNIQUE INDEX societies_alphabetic_id_idx ON societies(alphabetic_id);
