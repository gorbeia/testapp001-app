import type { StockMode } from "../shared/schema";
import { products, productRecipeLines } from "../shared/schema";
import { and, eq } from "drizzle-orm";
import type { SeedDb } from "./seed-db-type";

type Purpose = "sale" | "internal" | "both";

/**
 * Demo bulk/portion/composite/internal products for inventory taxonomy (see docs/features/inventory.md).
 * Idempotent: upserts by (name, societyId).
 */
export async function seedInventoryTaxonomyExamples(
  dbConn: SeedDb,
  societyId: string,
  getCategoryId: (icon: string) => string
) {
  const rows: Array<{
    name: string;
    description: string;
    icon: string;
    price: string;
    stock: string;
    unit: string;
    minStock: string;
    supplier: string | null;
    stockMode: StockMode;
    purpose: Purpose;
  }> = [
    {
      name: "Olio Oliba 5L",
      description: "Oliba olioa 5L — inbentarioa ml-tan; saltzen da dosietan",
      icon: "ChefHat",
      price: "15.00",
      stock: "10000",
      unit: "ml",
      minStock: "500",
      supplier: "Oil Supplier",
      stockMode: "auto",
      purpose: "internal",
    },
    {
      name: "Garagardo Tiratua (Barrika)",
      description: "Garagardo tiratua barrikan — ml-tan; eskuzko inbentarioa (kopak)",
      icon: "Beer",
      price: "90.00",
      stock: "60000",
      unit: "ml",
      minStock: "5000",
      supplier: "Kalea Brewery",
      stockMode: "manual",
      purpose: "internal",
    },
    {
      name: "Gin Botila",
      description: "Gina700ml botila — stock ml-tan (2 botila)",
      icon: "Beer",
      price: "18.00",
      stock: "1400",
      unit: "ml",
      minStock: "200",
      supplier: "Spirits Co",
      stockMode: "auto",
      purpose: "internal",
    },
    {
      name: "Tonika",
      description: "Tonika lata",
      icon: "Beer",
      price: "2.00",
      stock: "24",
      unit: "unit",
      minStock: "6",
      supplier: "Soft Drinks",
      stockMode: "auto",
      purpose: "sale",
    },
    {
      name: "Coca-Cola",
      description: "Coca-Cola lata",
      icon: "Beer",
      price: "1.80",
      stock: "48",
      unit: "unit",
      minStock: "12",
      supplier: "Soft Drinks",
      stockMode: "auto",
      purpose: "sale",
    },
    {
      name: "Ardo Gorri Botila",
      description: "Ardo gorria750ml — botila osoa edo kalimotxorako",
      icon: "Beer",
      price: "6.00",
      stock: "15",
      unit: "unit",
      minStock: "4",
      supplier: "Local Winery",
      stockMode: "auto",
      purpose: "sale",
    },
    {
      name: "Olio Oliba Dosi (100ml)",
      description: "Oliba olioaren100ml dosia",
      icon: "ChefHat",
      price: "0.50",
      stock: "0",
      unit: "ml",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Zurito",
      description: "Garagardo zurito (150ml)",
      icon: "Beer",
      price: "1.50",
      stock: "0",
      unit: "ml",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Kaina",
      description: "Garagardo kaina (330ml)",
      icon: "Beer",
      price: "2.50",
      stock: "0",
      unit: "ml",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Pinta",
      description: "Garagardo pinta (500ml)",
      icon: "Beer",
      price: "3.50",
      stock: "0",
      unit: "ml",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Txakoli Kopa",
      description: "Txakoli kopa (botilaren ~1/6)",
      icon: "Beer",
      price: "3.00",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Gin Tonic",
      description: "Gin tonic (50ml gin + 1 tonika)",
      icon: "Beer",
      price: "7.00",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Kalimotxo",
      description: "Kalimotxo (ardo gorriaren 1/6 + 0.5 kola)",
      icon: "Beer",
      price: "3.00",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Menu Txikia",
      description: "Menu txikia: patata + garagardo kalekoa",
      icon: "Utensils",
      price: "4.50",
      stock: "0",
      unit: "unit",
      minStock: "0",
      supplier: null,
      stockMode: "none",
      purpose: "sale",
    },
    {
      name: "Garbigarria",
      description: "Sukaldeko garbigarria (barnekoa)",
      icon: "Sparkles",
      price: "3.50",
      stock: "12",
      unit: "unit",
      minStock: "3",
      supplier: "Cleaning Supply",
      stockMode: "auto",
      purpose: "internal",
    },
  ];

  console.log("Seeding inventory taxonomy example products...");

  for (const r of rows) {
    const categoryId = getCategoryId(r.icon);
    const existing = await dbConn
      .select()
      .from(products)
      .where(and(eq(products.name, r.name), eq(products.societyId, societyId)))
      .limit(1);

    if (existing.length === 0) {
      await dbConn.insert(products).values({
        name: r.name,
        description: r.description,
        categoryId,
        price: r.price,
        stock: r.stock,
        unit: r.unit,
        minStock: r.minStock,
        supplier: r.supplier,
        isActive: true,
        stockMode: r.stockMode,
        purpose: r.purpose,
        societyId,
      });
      console.log(`  Added taxonomy product: ${r.name}`);
    } else {
      await dbConn
        .update(products)
        .set({
          description: r.description,
          stockMode: r.stockMode,
          purpose: r.purpose,
          unit: r.unit,
          price: r.price,
          minStock: r.minStock,
          supplier: r.supplier,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, existing[0].id), eq(products.societyId, societyId)));
      console.log(`  Taxonomy product exists (updated): ${r.name}`);
    }
  }

  async function productIdByName(name: string): Promise<string | null> {
    const [row] = await dbConn
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.name, name), eq(products.societyId, societyId)))
      .limit(1);
    return row?.id ?? null;
  }

  const portionLinks: Array<{ portion: string; parent: string; units: string }> = [
    { portion: "Olio Oliba Dosi (100ml)", parent: "Olio Oliba 5L", units: "100" },
    { portion: "Zurito", parent: "Garagardo Tiratua (Barrika)", units: "150" },
    { portion: "Kaina", parent: "Garagardo Tiratua (Barrika)", units: "330" },
    { portion: "Pinta", parent: "Garagardo Tiratua (Barrika)", units: "500" },
    { portion: "Txakoli Kopa", parent: "Txakoli Getariako", units: "0.1667" },
  ];

  for (const link of portionLinks) {
    const parentId = await productIdByName(link.parent);
    const portionId = await productIdByName(link.portion);
    if (!parentId || !portionId) {
      console.warn(`  Skip portion link (missing product): ${link.portion} -> ${link.parent}`);
      continue;
    }
    await dbConn
      .update(products)
      .set({
        parentProductId: parentId,
        parentUnitsPerSale: link.units,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, portionId), eq(products.societyId, societyId)));
    console.log(`  Linked portion: ${link.portion} -> ${link.parent}`);
  }

  const recipes: Array<{
    composite: string;
    lines: Array<{ ingredient: string; quantity: string }>;
  }> = [
    {
      composite: "Gin Tonic",
      lines: [
        { ingredient: "Gin Botila", quantity: "50" },
        { ingredient: "Tonika", quantity: "1" },
      ],
    },
    {
      composite: "Kalimotxo",
      lines: [
        { ingredient: "Ardo Gorri Botila", quantity: "0.1667" },
        { ingredient: "Coca-Cola", quantity: "0.5" },
      ],
    },
    {
      composite: "Menu Txikia",
      lines: [
        { ingredient: "Patata Frita", quantity: "1" },
        { ingredient: "Kalea Garagardoa", quantity: "1" },
      ],
    },
  ];

  for (const recipe of recipes) {
    const compositeId = await productIdByName(recipe.composite);
    if (!compositeId) {
      console.warn(`  Skip recipe (missing composite): ${recipe.composite}`);
      continue;
    }
    await dbConn.delete(productRecipeLines).where(eq(productRecipeLines.productId, compositeId));
    for (const line of recipe.lines) {
      const ingId = await productIdByName(line.ingredient);
      if (!ingId) {
        console.warn(`  Skip recipe line (missing ingredient): ${line.ingredient}`);
        continue;
      }
      await dbConn.insert(productRecipeLines).values({
        productId: compositeId,
        ingredientProductId: ingId,
        quantity: line.quantity,
      });
    }
    console.log(`  Seeded recipe: ${recipe.composite} (${recipe.lines.length} lines)`);
  }
}
