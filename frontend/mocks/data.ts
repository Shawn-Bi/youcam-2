import { ApiError, OutOfStockError } from "@/lib/errors";
import { catalogItems, getCatalogItem, itemsInStore, toProposalItem, type CatalogItem } from "@/lib/catalog";
import type { BriefInput, BriefResponse, Item, Proposal, TaskResult } from "@/lib/types";

// Mock proposals for the demo brief "Silver-and-black concert look, under $120. Keep my boots."
// Items come from the shared catalog (data/catalog.json), like the backend's will.

type Plan = { id: string; storeId: string; storeName: string; itemIds: string[]; rationale: string };

const plansFor = (key: string): Plan[] => [
  {
    id: `prop_northline_${key}`,
    storeId: "northline",
    storeName: "Northline",
    itemIds: ["nl_racer_jacket", "nl_luna_bag"],
    rationale: "A sharp silver-striped layer that works with what you already own for a stage-ready look.",
  },
  {
    id: `prop_mono_${key}`,
    storeId: "mono-studio",
    storeName: "Mono Studio",
    itemIds: ["ms_shine_jacket", "ms_nova_bag"],
    rationale: "Minimal black shine with a silver chain bag, easy to move in all night.",
  },
  {
    id: `prop_sol_${key}`,
    storeId: "sol-social",
    storeName: "Sol Social",
    itemIds: ["sol_sequin_jacket", "sol_beaded_bag"],
    rationale: "A silver sequin jacket that catches every stage light, with a beaded bag for a pop of color.",
  },
  {
    id: `prop_haven_${key}`,
    storeId: "haven",
    storeName: "Haven",
    itemIds: ["hv_quilted_jacket", "hv_canvas_sling"],
    rationale: "A soft quilted layer that stays comfortable all night, with a hands-free sling for the crowd.",
  },
];

const sizeFor = (item: CatalogItem, input: BriefInput) =>
  item.category === "bottom" ? (input.sizes.bottom ?? input.sizes.top) : input.sizes.top;
const fits = (item: CatalogItem, input: BriefInput) =>
  item.sizesInStock.length === 0 || item.sizesInStock.includes(sizeFor(item, input));

/** An outfit has one upper piece (top or jacket), optional bottoms and an optional bag. */
const slot = (item: CatalogItem) => (item.category === "top" ? "outer" : item.category);

/** A catalog piece the brief names, e.g. "Build a look around the Grey knit sweater from Mono Studio." */
const namedPiece = (text: string) => catalogItems.find((i) => text.toLowerCase().includes(i.name.toLowerCase()));

function buildProposal(plan: Plan, input: BriefInput): Proposal {
  const named = namedPiece(input.text);
  const wanted = named?.storeId === plan.storeId && fits(named, input) ? named : undefined;
  // Like the backend, never offer a size the shopper didn't ask for: swap in a
  // same-category piece from this store that has it, or leave the piece out.
  const picked = plan.itemIds.flatMap((itemId) => {
    const first = getCatalogItem(itemId)!;
    if (wanted && slot(wanted) === slot(first)) return [];
    const item = fits(first, input) ? first : itemsInStore(plan.storeId).find((i) => i.category === first.category && fits(i, input));
    return item ? [item] : [];
  });
  const chosen = wanted ? [wanted, ...picked] : picked;
  const items = chosen.map((item) => toProposalItem(item, sizeFor(item, input)));
  return {
    id: plan.id,
    storeId: plan.storeId,
    storeName: plan.storeName,
    items,
    kept: [],
    subtotal: items.reduce((sum, i) => sum + i.price, 0),
    rationale: wanted ? `Built around the ${wanted.name} you picked, with a piece that finishes the look.` : plan.rationale,
    version: 1,
    selected: false,
  };
}

/**
 * Mimics the backend: a store answers with no items when its outfit is over budget
 * or it has no clothing in the shopper's size (a bag alone is not a look).
 */
export function mockBriefResponse(input: BriefInput): BriefResponse {
  // Each brief gets its own proposal ids, as the backend does, so saved previews never carry over.
  const key = Date.now().toString(36);
  return {
    briefId: `brief_${key}`,
    proposals: plansFor(key).map((plan) => {
      const p = buildProposal(plan, input);
      const noMatch = (rationale: string): Proposal => ({ ...p, items: [], kept: [], subtotal: 0, rationale });
      if (!p.items.some((i) => i.category !== "bag")) return noMatch(`Nothing in size ${input.sizes.top} for this look.`);
      if (p.subtotal > input.budget) return noMatch(`Nothing in your size came in under $${input.budget}.`);
      return { ...p, kept: input.keep };
    }),
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
  // The mock keeps the photo only in memory, so a page reload loses it.
  if (!mockPhotoUrl) return { status: "failed", error: "Mock mode lost your photo when the page reloaded. Post the brief again." };
  return { status: "success", imageUrl: mockPhotoUrl };
}

// --- Video ------------------------------------------------------------------------
// The mock video is a real 5-second clip recorded in the browser: a slow zoom on the
// shopper's photo. Recording takes about as long as YouCam does, so the progress state is realistic.
const videoTasks = new Map<string, { promise: Promise<string> | null; result: TaskResult }>();

function recordZoomClip(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("image"));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx || typeof MediaRecorder === "undefined") return reject(new Error("unsupported"));
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm" });
      } catch (err) {
        return reject(err);
      }
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
      // A timer, not requestAnimationFrame: animation frames pause in background tabs and the clip would never finish.
      const start = performance.now();
      const draw = () => {
        const t = Math.min((performance.now() - start) / 5000, 1);
        const scale = 1 + 0.12 * t;
        const cover = Math.max(canvas.width / img.width, canvas.height / img.height) * scale;
        const w = img.width * cover;
        const h = img.height * cover;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2 - 20 * t, w, h);
        if (t < 1) setTimeout(draw, 33);
        else recorder.stop();
      };
      recorder.start();
      draw();
    };
    img.src = imageUrl;
  });
}

export function mockStartVideo(previewId: string): { videoId: string } {
  const videoId = `video_${previewId}_${Date.now().toString(36)}`;
  const task: { promise: Promise<string> | null; result: TaskResult } = { promise: null, result: { status: "running" } };
  if (!mockPhotoUrl) {
    task.result = { status: "failed", error: "Add your photo again to make a video." };
  } else {
    task.promise = recordZoomClip(mockPhotoUrl);
    task.promise.then(
      (videoUrl) => (task.result = { status: "success", videoUrl }),
      () => (task.result = { status: "failed", error: "The video service couldn't finish this clip. Try again." }),
    );
  }
  videoTasks.set(videoId, task);
  return { videoId };
}

export function mockGetVideo(videoId: string): TaskResult {
  return videoTasks.get(videoId)?.result ?? { status: "failed", error: "We lost track of this video. Try again." };
}

// --- Revising a proposal ---------------------------------------------------------
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
  const pool = itemsInStore(proposal.storeId).map((i) => toProposalItem(i, null));
  const next = pool.find((i) => i.category === current.category && !inUse.has(i.itemId));
  if (!next) throw new ApiError(`${proposal.storeName} has no other ${current.category === "bag" ? "bags" : "pieces"} that fit this brief.`);
  const size = next.sizesInStock.length === 0 ? null : next.sizesInStock.includes(current.size ?? "") ? current.size : next.sizesInStock[0];
  return withSubtotal(
    proposal,
    proposal.items.map((i) => (i.itemId === itemId ? { ...next, size, locked: false } : i)),
  );
}
