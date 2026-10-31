import { getCatalogItem, toProposalItem } from "./catalog";
import type { Proposal } from "./types";

// The first full run on the live site (see docs/demo/README.md), kept as data so the
// example page can replay it without the backend. The brief was started from the
// cardigan's product page, so Haven built its look around that piece.

export const EXAMPLE_BRIEF = {
  text: "Build a look around the Chunky oatmeal cardigan from Haven.",
  size: "M",
  budget: 200,
};

/** The store whose look was tried on, and the piece the video was made from. */
export const EXAMPLE_STORE_ID = "haven";
export const EXAMPLE_ITEM_ID = "hv_chunky_cardigan";

export const EXAMPLE_PHOTO = "/demo/model-photo.png";
export const EXAMPLE_TRY_ON = "/demo/haven-cardigan-tryon.jpg";
export const EXAMPLE_VIDEO = "/demo/haven-cardigan-video.mp4";

function look(storeId: string, storeName: string, itemIds: string[], rationale: string): Proposal {
  // Items come from the shared catalog, so names, prices and photos match the shop pages.
  const items = itemIds.flatMap((id) => {
    const item = getCatalogItem(id);
    return item ? [toProposalItem(item, EXAMPLE_BRIEF.size)] : [];
  });
  return {
    id: `example-${storeId}`,
    storeId,
    storeName,
    items,
    kept: [],
    subtotal: items.reduce((sum, i) => sum + i.price, 0),
    rationale,
    version: 1,
    selected: storeId === EXAMPLE_STORE_ID,
  };
}

/** What the four stores answered, in the order the backend returned them. */
export const EXAMPLE_PROPOSALS: Proposal[] = [
  look(
    "northline",
    "Northline",
    ["nl_chrome_bomber", "nl_chain_bag"],
    "Chrome-zip bomber and Silver chain bag, the closest in-stock match for your size. $136 of your $200 budget.",
  ),
  look(
    "mono-studio",
    "Mono Studio",
    ["ms_wool_blazer", "ms_nova_bag"],
    "Boxy wool blazer and Nova chain bag, the closest in-stock match for your size. $128 of your $200 budget.",
  ),
  look(
    "sol-social",
    "Sol Social",
    ["sol_sequin_jacket", "sol_disco_bag"],
    "Silver sequin jacket and Disco ball bag, the closest in-stock match for your size. $122 of your $200 budget.",
  ),
  look(
    "haven",
    "Haven",
    ["hv_chunky_cardigan", "hv_suede_pouch"],
    "Built around the Chunky oatmeal cardigan you picked, with Suede pouch bag to finish the look. $112 of your $200 budget.",
  ),
];
