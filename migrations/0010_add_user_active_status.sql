-- Add is_active field to users table
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add society_id foreign key constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_society_id_fkey' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
