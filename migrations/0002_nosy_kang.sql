CREATE TABLE "notification_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"society_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"default_language" varchar DEFAULT 'eu' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oharrak_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oharrak_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_rooms" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "chat_messages" CASCADE;--> statement-breakpoint
DROP TABLE "chat_rooms" CASCADE;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "alphabetic_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oharrak_messages" ADD CONSTRAINT "oharrak_messages_oharrak_id_oharrak_id_fk" FOREIGN KEY ("oharrak_id") REFERENCES "public"."oharrak"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oharrak" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "oharrak" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "tables" DROP COLUMN "location";--> statement-breakpoint
ALTER TABLE "societies" ADD CONSTRAINT "societies_alphabetic_id_unique" UNIQUE("alphabetic_id");

-- Rename oharrak table to notes
ALTER TABLE "oharrak" RENAME TO "notes";--> statement-breakpoint

-- Rename oharrak_messages table to note_messages  
ALTER TABLE "oharrak_messages" RENAME TO "note_messages";--> statement-breakpoint

-- Update foreign key constraint names after rename
ALTER TABLE "note_messages" DROP CONSTRAINT "oharrak_messages_oharrak_id_oharrak_id_fk";--> statement-breakpoint
ALTER TABLE "note_messages" ADD CONSTRAINT "note_messages_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;

-- Migrate existing notes to multilanguage structure
INSERT INTO "note_messages" ("note_id", "language", "title", "content")
SELECT 
    id as "note_id",
    'eu' as "language",
    title,
    content
FROM "notes"
WHERE title IS NOT NULL AND content IS NOT NULL
ON CONFLICT ("note_id", "language") DO NOTHING;

-- Create Spanish translations for existing notes (basic translations)
INSERT INTO "note_messages" ("note_id", "language", "title", "content")
SELECT 
    id as "note_id",
    'es' as "language",
    CASE 
        WHEN title = 'Ondo etorri!' THEN '¡Bienvenido!'
        WHEN title = 'Gogoratu: Kontsumoak itxi' THEN 'Recuerda: Cerrar consumos'
        WHEN title = 'Produktu berriak eskuragarri' THEN 'Nuevos productos disponibles'
        WHEN title = 'Sistemaren mantenua' THEN 'Mantenimiento del sistema'
        WHEN title = 'Erreserbak egiteko modua' THEN 'Cómo hacer reservas'
        WHEN title = 'Ordainketa metodoak' THEN 'Métodos de pago'
        WHEN title = 'Laguntza teknikoa' THEN 'Soporte técnico'
        WHEN title = 'Hilabeteko bilera' THEN 'Reunión mensual'
        ELSE title
    END as "title",
    CASE 
        WHEN content LIKE '%Txokora ongi etorri!%' THEN '¡Bienvenido al Txoko! Aquí puedes gestionar tus consumos y reservas.'
        WHEN content LIKE '%kontsumoak hilaren amaieran ixtea%' THEN 'Por favor, recuerda cerrar los consumos al final del mes. Así las deudas se calcularán correctamente.'
        WHEN content LIKE '%produktu berriak gehitu dira%' THEN 'Hoy se han añadido nuevos productos: sidra natural y queso de pastor nuevo. ¡Pruébalos!'
        WHEN content LIKE '%sistemaren mantenua egingo da%' THEN 'El miércoles de 22:00 a 23:00 habrá mantenimiento del sistema. El servicio no estará disponible durante ese tiempo.'
        WHEN content LIKE '%Erreserbak egiteko, joan "Erreserbak" atalera%' THEN 'Para hacer reservas, ve a la sección "Reservas" y selecciona fecha y número de personas. Ten en cuenta el precio de cocina por persona.'
        WHEN content LIKE '%banku-transferentziaz egin behar dira%' THEN 'Todos los pagos deben hacerse por transferencia bancaria. Número de cuenta: ESXX XXXX XXXX XXXX XXXX.'
        WHEN content LIKE '%Arazo teknikorik baduzu%' THEN 'Si tienes problemas técnicos, contacta con el administrador: admin@txokoa.eus o 612 345 678.'
        WHEN content LIKE '%Hilabeteko bilera ostegunean%' THEN 'La reunión mensual será el jueves a las 19:00. Para discutir el estado del txoko y las cuentas.'
        ELSE content
    END as "content"
FROM "notes"
WHERE title IS NOT NULL AND content IS NOT NULL
ON CONFLICT ("note_id", "language") DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_note_messages_note_id" ON "note_messages"("note_id");
CREATE INDEX IF NOT EXISTS "idx_note_messages_language" ON "note_messages"("language");