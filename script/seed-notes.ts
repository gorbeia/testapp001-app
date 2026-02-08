import { db } from "../server/db";
import { notes, noteMessages, societies, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function seedNotes() {
  console.log("Seeding notes with multilanguage and single-language content...");

  try {
    // Get the first society and admin user for seeding
    const [society] = await db.select().from(societies).limit(1);
    if (!society) {
      throw new Error("No society found. Please seed societies first.");
    }

    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "bazkidea"), eq(users.function, "administratzailea")))
      .limit(1);
    if (!adminUser) {
      throw new Error("No admin user found. Please seed users first.");
    }

    // Sample notes with various language combinations for testing fallback functionality
    const sampleNotes = [
      // Bilingual notes (normal operation)
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

      // Basque-only notes (for testing Spanish fallback)
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

      // Spanish-only notes (for testing Basque fallback)
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

      // More bilingual notes for variety
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

    // Check if notes already exist
    const existingNotes = await db.select().from(notes).where(eq(notes.societyId, society.id));
    if (existingNotes.length > 0) {
      console.log(`Found ${existingNotes.length} existing notes. Skipping seeding.`);
      return;
    }

    // Insert notes and their messages
    const insertedNotes = await Promise.all(
      sampleNotes.map(async noteData => {
        // Insert the main note
        const [insertedNote] = await db
          .insert(notes)
          .values({
            isActive: noteData.isActive,
            createdBy: noteData.createdBy,
            societyId: noteData.societyId,
          })
          .returning();

        // Insert messages for this note
        const insertedMessages = await Promise.all(
          noteData.messages.map(async message => {
            return await db
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
  } catch (error) {
    console.error("Error seeding notes:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedNotes()
    .then(() => {
      console.log("Notes seeding completed successfully");
      process.exit(0);
    })
    .catch(error => {
      console.error("Notes seeding failed:", error);
      process.exit(1);
    });
}

export { seedNotes };
