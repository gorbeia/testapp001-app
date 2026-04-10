-- Login email unique per society (same address may exist in different societies).
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_unique";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_key";
ALTER TABLE "users" ADD CONSTRAINT "users_society_id_username_unique" UNIQUE ("society_id", "username");
