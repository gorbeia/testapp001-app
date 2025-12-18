-- Add referenceId field to notifications table
ALTER TABLE notifications ADD COLUMN reference_id VARCHAR(255);
