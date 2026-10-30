import { ApiError, OutOfStockError } from "@/lib/errors";
import type { BriefInput, BriefResponse, Item, Proposal, TaskResult } from "@/lib/types";

// Mock proposals for the demo brief "Silver-and-black concert look, under $120. Keep my boots."
// Product images stay empty until the sample catalogs exist; the UI shows a placeholder.
const proposals: Proposal[] = [
  {
    id: "prop_northline",
    storeId: "northline",
    storeName: "Northline",
    items: [
      {
        itemId: "nl_racer_jacket",
        name: "Racer leather jacket",
        category: "outer",
        price: 89,
        size: "M",
        sizesInStock: ["S", "M", "L"],
        imageUrl: "",
        productUrl: "#",
        locked: false,
      },
      {
        itemId: "nl_luna_bag",
        name: "Luna shoulder bag",
        category: "bag",
        price: 25,
        size: null,
        sizesInStock: [],
        imageUrl: "",
        productUrl: "#",
        locked: false,
      },
    ],
    kept: [],
    subtotal: 114,
    rationale: "A sharp silver-striped layer that works with what you already own for a stage-ready look.",
    version: 1,
    selected: false,
  },
  {
    id: "prop_mono",
    storeId: "mono-studio",
    storeName: "Mono Studio",
    items: [
      {
        itemId: "ms_shine_jacket",
        name: "Shine zip jacket",
        category: "outer",
        price: 78,
        size: "M",
        sizesInStock: ["XS", "M", "XL"],
        imageUrl: "",
        productUrl: "#",
        locked: false,
      },
      {
        itemId: "ms_nova_bag",
        name: "Nova chain bag",
        category: "bag",
        price: 30,
        size: null,
        sizesInStock: [],
        imageUrl: "",
        productUrl: "#",
        locked: false,
      },
    ],
    kept: [],
    subtotal: 108,
    rationale: "Minimal black shine with a silver chain bag, easy to move in all night.",
    version: 1,
    selected: false,
  },
];

/**
 * Mimics the backend: a store whose proposal is over budget answers with no items,
 * so the no-match state can be tried by entering a budget under $114 or $108.
 */
export function mockBriefResponse(input: BriefInput): BriefResponse {
  return {
    briefId: `brief_${Date.now().toString(36)}`,
    proposals: proposals.map((p) =>
      p.subtotal <= input.budget
        ? { ...p, kept: input.keep }
        : {
            ...p,
            items: [],
            kept: [],
            subtotal: 0,
            rationale: `Nothing in your size came in under $${input.budget}.`,
          },
    ),
  };
}

export function mockSelect(proposal: Proposal): Proposal {
  return { ...proposal, selected: true };
}

// --- Photo and try-on previews -------------------------------------------------
// The mock "try-on" shows the shopper's own photo, so the layout can be judged with real proportions.
let mockPhotoUrl: string | null = null;

export function mockUploadPhoto(photo: File): { photoId: string } {
  mockPhotoUrl = URL.createObjectURL(photo);
  return { photoId: `photo_${Date.now().toString(36)}` };
}

const previewTasks = new Map<string, { startedAt: number; fails: boolean }>();
const failedOnce = new Set<string>();

/** Bag previews fail on the first try so the error and retry states can be exercised. */
export function mockStartPreview(itemId: string): { previewId: string } {
  const previewId = `preview_${itemId}_${Date.now().toString(36)}`;
  const fails = itemId.endsWith("_bag") && !failedOnce.has(itemId);
  if (fails) failedOnce.add(itemId);
  previewTasks.set(previewId, { startedAt: Date.now(), fails });
  return { previewId };
}

export function mockGetPreview(previewId: string): TaskResult {
  const task = previewTasks.get(previewId);
  if (!task) return { status: "failed", error: "We lost track of this preview. Try again." };
  const elapsed = Date.now() - task.startedAt;
  if (elapsed < 1000) return { status: "queued" };
  if (elapsed < 4000) return { status: "running" };
  if (task.fails) return { status: "failed", error: "The try-on service couldn't read this photo. Try again." };
  return { status: "success", imageUrl: mockPhotoUrl ?? "" };
}

// --- Revising a proposal ---------------------------------------------------------
const alternatives: Record<string, Item[]> = {
  northline: [
    { itemId: "nl_vinyl_jacket", name: "Cropped vinyl jacket", category: "outer", price: 72, size: null, sizesInStock: ["S", "M"], imageUrl: "", productUrl: "#", locked: false },
    { itemId: "nl_mesh_bag", name: "Mesh mini bag", category: "bag", price: 15, size: null, sizesInStock: [], imageUrl: "", productUrl: "#", locked: false },
  ],
  "mono-studio": [
    { itemId: "ms_satin_bomber", name: "Satin bomber", category: "outer", price: 70, size: null, sizesInStock: ["M", "L"], imageUrl: "", productUrl: "#", locked: false },
    { itemId: "ms_disc_bag", name: "Disc bag", category: "bag", price: 18, size: null, sizesInStock: [], imageUrl: "", productUrl: "#", locked: false },
  ],
};

const withSubtotal = (p: Proposal, items: Item[]): Proposal => ({
  ...p,
  items,
  subtotal: items.reduce((sum, i) => sum + i.price, 0),
  version: p.version + 1,
});

export function mockUpdateItem(proposal: Proposal, itemId: string, patch: { size: string } | { locked: boolean }): Proposal {
  const items = proposal.items.map((item) => {
    if (item.itemId !== itemId) return item;
    if ("size" in patch && !item.sizesInStock.includes(patch.size)) {
      throw new OutOfStockError([]);
    }
    return { ...item, ...patch };
  });
  return withSubtotal(proposal, items);
}

export function mockReplace(proposal: Proposal, itemId: string): Proposal {
  const current = proposal.items.find((i) => i.itemId === itemId);
  if (!current) throw new ApiError("That item is no longer in this proposal.");
  const inUse = new Set(proposal.items.map((i) => i.itemId));
  const pool = [...(alternatives[proposal.storeId] ?? []), ...proposals.flatMap((p) => (p.storeId === proposal.storeId ? p.items : []))];
  const next = pool.find((i) => i.category === current.category && !inUse.has(i.itemId));
  if (!next) throw new ApiError(`${proposal.storeName} has no other ${current.category === "bag" ? "bags" : "pieces"} that fit this brief.`);
  const size = next.sizesInStock.length === 0 ? null : next.sizesInStock.includes(current.size ?? "") ? current.size : next.sizesInStock[0];
  return withSubtotal(
    proposal,
    proposal.items.map((i) => (i.itemId === itemId ? { ...next, size, locked: false } : i)),
  );
}
