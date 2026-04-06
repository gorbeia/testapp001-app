import "dotenv/config";
import { productCategories, categoryMessages, societies } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";

export async function seedCategories(dbConn: SeedDb) {
  let societyId = "";
  const activeSociety = await dbConn
    .select()
    .from(societies)
    .where(eq(societies.isActive, true))
    .limit(1);
  if (activeSociety.length === 0) {
    const firstSociety = await dbConn.select().from(societies).limit(1);
    if (firstSociety.length === 0) {
      throw new Error("No societies found in database");
    }
    societyId = firstSociety[0].id;
  } else {
    societyId = activeSociety[0].id;
  }

  console.log("Using society ID for categories:", societyId);

  const demoCategories = [
    {
      color: "#3B82F6",
      icon: "Beer",
      sortOrder: 1,
      isActive: true,
      messages: {
        eu: { name: "Edariak", description: "Edari guztiak: garagardoak, ardoak, ura, etab." },
        es: { name: "Bebidas", description: "Todas las bebidas: cervezas, vinos, agua, etc." },
      },
    },
    {
      color: "#10B981",
      icon: "Utensils",
      sortOrder: 2,
      isActive: true,
      messages: {
        eu: { name: "Aperitiboak", description: "Aperitiboak eta pintxoak" },
        es: { name: "Aperitivos", description: "Aperitivos y pinchos" },
      },
    },
    {
      color: "#F59E0B",
      icon: "Coffee",
      sortOrder: 3,
      isActive: true,
      messages: {
        eu: { name: "Kafeak", description: "Kafea, tea eta bero edariak" },
        es: { name: "Cafés", description: "Café, té y bebidas calientes" },
      },
    },
    {
      color: "#EF4444",
      icon: "ChefHat",
      sortOrder: 4,
      isActive: true,
      messages: {
        eu: { name: "Sukaldea", description: "Sukaldeko produktuak eta janaria" },
        es: { name: "Cocina", description: "Productos de cocina y comida" },
      },
    },
  ];

  console.log("Seeding demo categories with multilingual support...");

  for (const category of demoCategories) {
    const existingCategory = await dbConn
      .select()
      .from(productCategories)
      .where(eq(productCategories.color, category.color))
      .limit(1);

    let categoryId: string;

    if (existingCategory.length === 0) {
      const [newCategory] = await dbConn
        .insert(productCategories)
        .values({
          ...category,
          societyId,
        })
        .returning();
      categoryId = newCategory.id;
      console.log(`Added category: ${category.messages.eu.name}`);
    } else {
      categoryId = existingCategory[0].id;
      console.log(`Category already exists: ${category.messages.eu.name}`);
    }

    for (const [language, messageData] of Object.entries(category.messages)) {
      const existingMessage = await dbConn
        .select()
        .from(categoryMessages)
        .where(
          and(eq(categoryMessages.categoryId, categoryId), eq(categoryMessages.language, language))
        )
        .limit(1);

      if (existingMessage.length === 0) {
        await dbConn.insert(categoryMessages).values({
          categoryId,
          language,
          name: messageData.name,
          description: messageData.description || null,
        });
        console.log(`  Added ${language} message: ${messageData.name}`);
      } else {
        await dbConn
          .update(categoryMessages)
          .set({
            name: messageData.name,
            description: messageData.description || null,
            updatedAt: new Date(),
          })
          .where(eq(categoryMessages.id, existingMessage[0].id));
        console.log(`  Updated ${language} message: ${messageData.name}`);
      }
    }
  }

  console.log("Done.");
}

function isMainModule(): boolean {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  seedCategories(db)
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() =>
      pool.end().then(() => {
        process.exit(process.exitCode ?? 0);
      })
    );
}
