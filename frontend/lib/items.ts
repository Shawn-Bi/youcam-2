import type { Item, Proposal } from "./types";

/** Clothing that YouCam's clothes try-on can render (bags use a separate try-on). */
export const isApparel = (item: Item) => item.category !== "bag";

/** The outfit's main piece: previewed first and used to make the video. */
export const mainItem = (proposal: Proposal): Item | undefined =>
  proposal.items.find(isApparel) ?? proposal.items[0];

/** Only real web links are shown as product links. */
export const isWebUrl = (url: string) => /^https?:\/\//i.test(url);
