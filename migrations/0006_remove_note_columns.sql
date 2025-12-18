-- Remove old title and content columns from notes table
-- These columns are now handled by the note_messages table

ALTER TABLE notes DROP COLUMN IF EXISTS title;
ALTER TABLE notes DROP COLUMN IF EXISTS content;

-- Verify the schema is correct
-- Notes table should now only have: id, is_active, created_by, society_id, created_at, updated_at
