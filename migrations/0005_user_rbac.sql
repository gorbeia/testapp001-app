DO $$ BEGIN
 CREATE TYPE "public"."access_role" AS ENUM('admin', 'treasurer', 'cellarman', 'member');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."membership_type" AS ENUM('full_member', 'companion');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_role" "access_role";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "membership_type" "membership_type";
--> statement-breakpoint
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'function'
 ) THEN
   EXECUTE $u$
     UPDATE "users" SET "access_role" = CASE lower(coalesce("function"::text, ''))
       WHEN 'administratzailea' THEN 'admin'::access_role
       WHEN 'diruzaina' THEN 'treasurer'::access_role
       WHEN 'sotolaria' THEN 'cellarman'::access_role
       ELSE 'member'::access_role
     END
     WHERE "access_role" IS NULL
   $u$;
 END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
 ) THEN
   EXECUTE $u$
     UPDATE "users" SET "membership_type" = CASE lower(coalesce("role"::text, ''))
       WHEN 'laguna' THEN 'companion'::membership_type
       ELSE 'full_member'::membership_type
     END
     WHERE "membership_type" IS NULL
   $u$;
 END IF;
END $$;
--> statement-breakpoint
UPDATE "users" SET "access_role" = 'member'::"access_role" WHERE "access_role" IS NULL;
--> statement-breakpoint
UPDATE "users" SET "membership_type" = 'full_member'::"membership_type" WHERE "membership_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "access_role" SET DEFAULT 'member'::"access_role";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "membership_type" SET DEFAULT 'full_member'::"membership_type";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "access_role" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "membership_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "function";
