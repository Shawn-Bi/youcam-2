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

export type BriefInput = {
  photoId: string;
  text: string;
  budget: number;
  sizes: { top: string; bottom?: string };
  keep: string[];
  /** A catalog piece every store's outfit is built around, when the brief started on its product page. */
  itemId?: string;
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
