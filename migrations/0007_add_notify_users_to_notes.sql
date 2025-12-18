-- Add notify_users column to notes table
ALTER TABLE notes ADD COLUMN notify_users BOOLEAN NOT NULL DEFAULT false;
