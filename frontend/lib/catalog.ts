import data from "@/data/catalog.json";
import type { Category, Item } from "./types";

// The four sample stores and their products. The backend reads the same file
// (frontend/data/catalog.json) to build proposals, so prices and sizes match.

export type Store = {
  storeId: string;
  name: string;
  tagline: string;
  description: string;
  heroImage: string;
  /** Whether the store photo is dark (white text over it) or light (ink text). */
  tone: "dark" | "light";
};

export type CatalogItem = {
  itemId: string;
  storeId: string;
  name: string;
  category: Category;
  price: number;
  sizesInStock: string[];
  colors: string[];
  styleTags: string[];
  imageUrl: string;
  productUrl: string;
};

export const stores = data.stores as Store[];
export const catalogItems = data.items as CatalogItem[];

export const CATEGORY_NAMES: Record<Category, string> = {
  outer: "Jackets",
  top: "Tops",
  bottom: "Bottoms",
  bag: "Bags",
};

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export const getStore = (storeId: string) => stores.find((s) => s.storeId === storeId);
export const getCatalogItem = (itemId: string) => catalogItems.find((i) => i.itemId === itemId);
export const itemsInStore = (storeId: string) => catalogItems.filter((i) => i.storeId === storeId);

/** A catalog product as a proposal line, in the given size (bags have none). */
export function toProposalItem(item: CatalogItem, size: string | null): Item {
  return {
    itemId: item.itemId,
    name: item.name,
    category: item.category,
    price: item.price,
    size: item.sizesInStock.length === 0 ? null : size,
    sizesInStock: item.sizesInStock,
    imageUrl: item.imageUrl,
    productUrl: item.productUrl,
    locked: false,
  };
}
