// Shapes from the shared API contract (docs/look-exchange-prd.md, section 6).
// Change these only together with the backend.

export type TaskStatus = "queued" | "running" | "success" | "failed";

export type Category = "top" | "outer" | "bottom" | "bag";

export type Item = {
  itemId: string;
  name: string;
  category: Category;
  price: number;
  size: string | null;
  sizesInStock: string[];
  imageUrl: string;
  productUrl: string;
  locked: boolean;
};

export type Proposal = {
  id: string;
  storeId: string;
  storeName: string;
  items: Item[];
  kept: string[];
  subtotal: number;
  rationale: string;
  version: number;
  selected: boolean;
};

/**
 * The shopper writes one sentence; budget and size are read from it when mentioned.
 * Without a budget there is no price cap; without a size, items come back with
 * `size: null` and the shopper picks one on the proposal page.
 */
export type BriefInput = {
  photoId: string;
  text: string;
  budget?: number;
  sizes?: { top?: string; bottom?: string };
  keep: string[];
};

export type BriefResponse = {
  briefId: string;
  proposals: Proposal[];
};

export type FieldErrors = Record<string, string>;

export type TaskResult = {
  status: TaskStatus;
  imageUrl?: string;
  videoUrl?: string;
  error?: string;
};
