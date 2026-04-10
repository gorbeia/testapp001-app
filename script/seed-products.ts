import "dotenv/config";
import { products, societies, productCategories } from "../shared/schema";
import { and, eq } from "drizzle-orm";
import type { StockMode } from "../shared/schema";
import type { SeedDb } from "./seed-db-type";
import { db, pool } from "../server/db";
import { fileURLToPath } from "node:url";
import { seedInventoryTaxonomyExamples } from "./seed-inventory-taxonomy";

export async function seedProducts(dbConn: SeedDb) {
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

  console.log("Using society ID for products:", societyId);

  const categories = await dbConn.select().from(productCategories);

  const categoryMap: Record<string, string> = {
    edariak: "Beer",
    janariak: "Utensils",
    opilekuak: "ChefHat",
    kafea: "Coffee",
    bestelakoak: "ChefHat",
    garbiketak: "Sparkles",
  };

  function getCategoryId(icon: string): string {
    const category = categories.find(cat => cat.icon === icon);
    if (!category) {
      throw new Error(
        `Category with icon '${icon}' not found. Make sure categories are seeded first.`
      );
    }
    return category.id;
  }

  type DemoProductSeed = {
    name: string;
    description: string;
    categoryId: string;
    price: string;
    stock: string;
    unit: string;
    minStock: string;
    supplier: string | null;
    isActive: boolean;
    stockMode: StockMode;
  };

  const demoProducts: DemoProductSeed[] = [
    {
      name: "Kalea Garagardoa",
      description: "Garagardo lokal ekoizpena, 330ml botila",
      categoryId: "",
      price: "3.50",
      stock: "24",
      unit: "unit",
      minStock: "6",
      supplier: "Kalea Brewery",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Txakoli Getariako",
      description: "Txakoli zuria, 750ml botila (kopetan saltzen da; stock botiletan, ez kopetan)",
      categoryId: "",
      price: "12.00",
      stock: "12",
      unit: "unit",
      minStock: "3",
      supplier: "Local Winery",
      isActive: true,
      stockMode: "manual",
    },
    {
      name: "Ura Mineral",
      description: "Ura minerala, 1.5L botila",
      categoryId: "",
      price: "1.20",
      stock: "50",
      unit: "unit",
      minStock: "10",
      supplier: "Water Supplier",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Pintxo Tortilla",
      description: "Tortilla pintxoa (hornidura eguneko; ez dago clubeko inbentarioan)",
      categoryId: "",
      price: "2.50",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: "Sukalde kanpokoa",
      isActive: true,
      stockMode: "none",
    },
    {
      name: "Gilda Pintxo",
      description: "Gilda klasikoa (eguneko hornidura)",
      categoryId: "",
      price: "3.00",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: "Sukalde kanpokoa",
      isActive: true,
      stockMode: "none",
    },
    {
      name: "Txistorra Sandwich",
      description: "Txistorra ogitartekoa",
      categoryId: "",
      price: "5.50",
      stock: "10",
      unit: "unit",
      minStock: "3",
      supplier: "Kitchen",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Patata Frita",
      description: "Patata frijituak, 150g poltsa",
      categoryId: "",
      price: "2.00",
      stock: "30",
      unit: "unit",
      minStock: "8",
      supplier: "Snack Co",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Oliba Berdea",
      description: "Oliba berdeak, 200g potea",
      categoryId: "",
      price: "4.50",
      stock: "18",
      unit: "unit",
      minStock: "4",
      supplier: "Local Producer",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Kafea",
      description: "Espresso kafea",
      categoryId: "",
      price: "1.80",
      stock: "100",
      unit: "unit",
      minStock: "20",
      supplier: "Coffee Roaster",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Tila Belar",
      description: "Tila belar tea, poltsa",
      categoryId: "",
      price: "1.50",
      stock: "50",
      unit: "unit",
      minStock: "10",
      supplier: "Tea Supplier",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Sukaldeko Gatzak",
      description: "Gatz mahastua, 1kg",
      categoryId: "",
      price: "1.00",
      stock: "5",
      unit: "kg",
      minStock: "1",
      supplier: "Food Supplier",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Azukrea",
      description: "Azukre zuria, 1kg",
      categoryId: "",
      price: "2.00",
      stock: "8",
      unit: "kg",
      minStock: "2",
      supplier: "Food Supplier",
      isActive: true,
      stockMode: "auto",
    },
    {
      name: "Menu eguneko (kanpotik)",
      description: "Menua kanpoko hornitzailearekin; ordainketa zuzena, inbentariorik gabe",
      categoryId: "",
      price: "8.00",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: null,
      isActive: true,
      stockMode: "none",
    },
  ];

  const oldCategoryNames = [
    "edariak",
    "edariak",
    "edariak",
    "janariak",
    "janariak",
    "janariak",
    "opilekuak",
    "opilekuak",
    "kafea",
    "kafea",
    "bestelakoak",
    "bestelakoak",
    "janariak",
  ];
  demoProducts.forEach((product, index) => {
    const icon = categoryMap[oldCategoryNames[index]];
    product.categoryId = getCategoryId(icon);
  });

  console.log("Seeding demo products...");

  for (const product of demoProducts) {
    const existingProduct = await dbConn
      .select()
      .from(products)
      .where(and(eq(products.name, product.name), eq(products.societyId, societyId)))
      .limit(1);

    if (existingProduct.length === 0) {
      await dbConn.insert(products).values({
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        price: product.price,
        stock: product.stock,
        unit: product.unit,
        minStock: product.minStock,
        supplier: product.supplier,
        isActive: product.isActive,
        stockMode: product.stockMode,
        societyId,
      });
      console.log(`Added product: ${product.name} (${product.stockMode})`);
    } else {
      await dbConn
        .update(products)
        .set({
          stockMode: product.stockMode,
          description: product.description,
        })
        .where(and(eq(products.name, product.name), eq(products.societyId, societyId)));
      console.log(`Product already exists (updated stockMode/description): ${product.name}`);
    }
  }

  await seedInventoryTaxonomyExamples(dbConn, societyId, getCategoryId);

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
  seedProducts(db)
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
