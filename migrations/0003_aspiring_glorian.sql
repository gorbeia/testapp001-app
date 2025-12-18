ALTER TABLE "oharrak_messages" RENAME TO "note_messages";--> statement-breakpoint
ALTER TABLE "oharrak" RENAME TO "notes";--> statement-breakpoint
ALTER TABLE "note_messages" RENAME COLUMN "oharrak_id" TO "note_id";--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "oharrak_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "oharrak_society_id_societies_id_fk";
--> statement-breakpoint
ALTER TABLE "note_messages" DROP CONSTRAINT "oharrak_messages_oharrak_id_oharrak_id_fk";
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_messages" ADD CONSTRAINT "note_messages_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;