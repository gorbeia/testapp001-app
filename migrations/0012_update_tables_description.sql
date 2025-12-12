-- Add description column and drop location column
ALTER TABLE tables ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tables DROP COLUMN IF EXISTS location;
