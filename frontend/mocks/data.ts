import type { BriefInput, BriefResponse, Proposal } from "@/lib/types";

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
