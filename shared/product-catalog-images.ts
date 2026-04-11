import { z } from "zod";

export type ProductCatalogImage = {
  path: string;
  nameEu: string;
  nameEs: string;
};

export const PRODUCT_CATALOG_IMAGES = [
  // Beers
  {
    path: "/catalog/products/garagardo-kana.png",
    nameEu: "Garagardo kana",
    nameEs: "Caña de cerveza",
  },
  {
    path: "/catalog/products/zurito.png",
    nameEu: "Zurito",
    nameEs: "Zurito",
  },
  {
    path: "/catalog/products/radler.png",
    nameEu: "Radler garagardoa",
    nameEs: "Cerveza Radler",
  },
  // Wines
  {
    path: "/catalog/products/ardo-zuria-arrunta.png",
    nameEu: "Ardo zuria (edalontzi)",
    nameEs: "Vino blanco (vaso)",
  },
  {
    path: "/catalog/products/ardo-beltza-arrunta.png",
    nameEu: "Ardo beltza (edalontzi)",
    nameEs: "Vino tinto (vaso)",
  },
  {
    path: "/catalog/products/ardo-zuria-kopa.png",
    nameEu: "Txakoli kopa",
    nameEs: "Copa de txakoli",
  },
  {
    path: "/catalog/products/ardo-beltza-kopa.png",
    nameEu: "Ardo ondua kopa",
    nameEs: "Copa vino crianza",
  },
  // Cider
  {
    path: "/catalog/products/sagardoa.png",
    nameEu: "Sagardoa",
    nameEs: "Sidra",
  },
  // Soft drinks
  {
    path: "/catalog/products/cocacola.png",
    nameEu: "Coca-Cola botila",
    nameEs: "Botella Coca-Cola",
  },
  {
    path: "/catalog/products/kas-laranja.png",
    nameEu: "KAS laranja",
    nameEs: "KAS naranja",
  },
  // Other drinks
  {
    path: "/catalog/products/esnea-1l.png",
    nameEu: "Esne osoa (1L)",
    nameEs: "Leche entera (1L)",
  },
  // Hot drinks
  {
    path: "/catalog/products/kafesnea.png",
    nameEu: "Kafesnea",
    nameEs: "Café con leche",
  },
  // Food
  {
    path: "/catalog/products/tortilla.png",
    nameEu: "Tortilla pintxoa",
    nameEs: "Pincho de tortilla",
  },
  {
    path: "/catalog/products/chips.png",
    nameEu: "Patata chips razio",
    nameEs: "Ración patatas chips",
  },
  {
    path: "/catalog/products/olives.png",
    nameEu: "Oliba berdeak razio",
    nameEs: "Ración aceitunas verdes",
  },
] as const satisfies readonly ProductCatalogImage[];

const catalogPaths = PRODUCT_CATALOG_IMAGES.map(i => i.path) as [string, ...string[]];

export const productCatalogImagePathSchema = z.enum(catalogPaths);

export type ProductCatalogImagePath = z.infer<typeof productCatalogImagePathSchema>;
