-- Add payment tracking fields to credits table
ALTER TABLE credits ADD COLUMN "marked_as_paid_by" varchar REFERENCES users(id);
ALTER TABLE credits ADD COLUMN "marked_as_paid_at" timestamp;
