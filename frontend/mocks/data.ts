import type { BriefResponse } from "@/lib/types";

// Mock response for the demo brief "Silver-and-black concert look, under $120. Keep my boots."
// Product images are placeholders until the sample catalogs exist.
export const mockBriefResponse: BriefResponse = {
  briefId: "brief_demo",
  proposals: [
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
      kept: ["Your boots"],
      subtotal: 114,
      rationale: "A sharp silver-striped layer that matches your boots for a stage-ready look.",
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
      kept: ["Your boots"],
      subtotal: 108,
      rationale: "Minimal black shine with a silver chain bag, easy to move in all night.",
      version: 1,
      selected: false,
    },
  ],
};
