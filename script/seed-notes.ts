import "dotenv/config";
import { notes, noteMessages, societies, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedNotes(dbConn: SeedDb) {
  console.log("Seeding notes with multilanguage and single-language content...");

  const [society] = await dbConn.select().from(societies).limit(1);
  if (!society) {
    throw new Error("No society found. Please seed societies first.");
  }

  const [adminUser] = await dbConn
    .select()
    .from(users)
    .where(and(eq(users.membershipType, "full_member"), eq(users.accessRole, "admin")))
    .limit(1);
  if (!adminUser) {
    throw new Error("No admin user found. Please seed users first.");
  }

  const sampleNotes = [
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "eu",
          title: "Ondo etorri!",
          content: "Txokora ongi etorri! Hemen zure kontsumoak eta erreserbak kudea ditzakezu.",
        },
        {
          language: "es",
          title: "¡Bienvenido!",
          content: "¡Bienvenido al Txoko! Aquí puedes gestionar tus consumos y reservas.",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "eu",
          title: "Gogoratu: Kontsumoak itxi",
          content:
            "Mesedez, gogoratu kontsumoak hilaren amaieran ixtea. Horrela zorrak ondo kalkulatuko dira.",
        },
        {
          language: "es",
          title: "Recuerda: Cerrar consumos",
          content:
            "Por favor, recuerda cerrar los consumos al final del mes. Así las deudas se calcularán correctamente.",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "eu",
          title: "Txoko berria ireki da",
          content:
            "Ongi etorri txoko berriara! Gaurtik zure gune pribatua erabil dezakezu ekintzak antolatzeko.",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "eu",
          title: "Hilabeko bilera",
          content: "Hilabeko bilera ostiralean 19:00etan izango da. Ez ahaztu partehartzeko!",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "es",
          title: "Nueva función disponible",
          content: "Ya puedes reservar productos desde la aplicación. ¡Pruébala ahora!",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "es",
          title: "Mantenimiento programado",
          content:
            "El sistema estará en mantenimiento mañana de 10:00 a 12:00. Disculpen las molestias.",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "eu",
          title: "Produktu berriak eskuragarri",
          content:
            "Gaur produktu berriak gehitu dira: sagardo naturala eta gazta artzain berria. Probatu!",
        },
        {
          language: "es",
          title: "Nuevos productos disponibles",
          content:
            "Hoy se han añadido nuevos productos: sidra natural y queso de pastor nuevo. ¡Pruébalos!",
        },
      ],
    },
    {
      isActive: true,
      createdBy: adminUser.id,
      societyId: society.id,
      messages: [
        {
          language: "eu",
          title: "Sistemaren mantenua",
          content:
            "Asteazkenetan 22:00-23:00 artean sistemaren mantenua egingo da. Une horretan zerbitzua ezin da erabiliko.",
        },
        {
          language: "es",
          title: "Mantenimiento del sistema",
          content:
            "El miércoles de 22:00 a 23:00 habrá mantenimiento del sistema. El servicio no estará disponible durante ese tiempo.",
        },
      ],
    },
  ];

  const existingNotes = await dbConn.select().from(notes).where(eq(notes.societyId, society.id));
  if (existingNotes.length > 0) {
    console.log(`Found ${existingNotes.length} existing notes. Skipping seeding.`);
    return;
  }

  const insertedNotes = await Promise.all(
    sampleNotes.map(async noteData => {
      const [insertedNote] = await dbConn
        .insert(notes)
        .values({
          isActive: noteData.isActive,
          createdBy: noteData.createdBy,
          societyId: noteData.societyId,
        })
        .returning();

      const insertedMessages = await Promise.all(
        noteData.messages.map(async message => {
          return await dbConn
            .insert(noteMessages)
            .values({
              noteId: insertedNote.id,
              language: message.language,
              title: message.title,
              content: message.content,
            })
            .returning();
        })
      );

      return {
        ...insertedNote,
        messages: insertedMessages.flat(),
      };
    })
  );

  const bilingualCount = sampleNotes.filter(note => note.messages.length === 2).length;
  const basqueOnlyCount = sampleNotes.filter(
    note => note.messages.length === 1 && note.messages[0].language === "eu"
  ).length;
  const spanishOnlyCount = sampleNotes.filter(
    note => note.messages.length === 1 && note.messages[0].language === "es"
  ).length;

  console.log(`Successfully seeded ${insertedNotes.length} notes:
- ${bilingualCount} bilingual notes
- ${basqueOnlyCount} Basque-only notes (for Spanish fallback testing)
- ${spanishOnlyCount} Spanish-only notes (for Basque fallback testing)`);
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedNotes(db)
    .then(() => {
      console.log("Notes seeding completed successfully");
    })
    .catch(error => {
      console.error("Notes seeding failed:", error);
      process.exitCode = 1;
    })
    .finally(() =>
      pool.end().then(() => {
        process.exit(process.exitCode ?? 0);
      })
    );
}
