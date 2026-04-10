import { z } from "zod";

export type ProductCatalogImage = {
  path: string;
  nameEu: string;
  nameEs: string;
};

export const PRODUCT_CATALOG_IMAGES = [
  {
    path: "/catalog/products/cocacola.png",
    nameEu: "Coca-Cola botila",
    nameEs: "Botella Coca-Cola",
  },
  {
    path: "/catalog/products/esnea-1l.png",
    nameEu: "Esne osoa (1L)",
    nameEs: "Leche entera (1L)",
  },
  {
    path: "/catalog/products/garagardo-kana.png",
    nameEu: "Garagardo kana",
    nameEs: "Caña de cerveza",
  },
  {
    path: "/catalog/products/kas-laranja.png",
    nameEu: "KAS laranja",
    nameEs: "KAS naranja",
  },
  {
    path: "/catalog/products/zurito.png",
    nameEu: "Zurito",
    nameEs: "Zurito",
  },
  {
    path: "/catalog/products/tortilla.png",
    nameEu: "Tortilla pintxoa",
    nameEs: "Pincho de tortilla",
  },
] as const satisfies readonly ProductCatalogImage[];

const catalogPaths = PRODUCT_CATALOG_IMAGES.map(i => i.path) as [string, ...string[]];

export const productCatalogImagePathSchema = z.enum(catalogPaths);

export type ProductCatalogImagePath = z.infer<typeof productCatalogImagePathSchema>;
