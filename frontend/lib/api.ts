import * as mock from "@/mocks/data";
import { ApiError, OutOfStockError, ValidationError } from "./errors";
import type { BriefInput, BriefResponse, Proposal, TaskResult } from "./types";

export { ApiError, OutOfStockError, ValidationError };

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const proposalPath = (id: string) => `/api/proposals/${encodeURIComponent(id)}`;
const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new ApiError("We couldn't reach Look Exchange. Check your connection and try again.", true);
  }
  if (res.ok) return res.json() as Promise<T>;
  const body = (await res.json().catch(() => null)) ?? {};
  if (res.status === 422 && body.errors) throw new ValidationError(body.errors);
  if (res.status === 409 && body.code === "out_of_stock") throw new OutOfStockError(body.alternatives ?? []);
  // The backend explains other refusals in plain words ("Select this proposal first.",
  // "Generation limit reached…"), so show its message rather than a generic one.
  throw new ApiError(typeof body.error === "string" ? body.error : "Something went wrong on our side. Try again in a moment.");
}

export async function uploadPhoto(photo: File): Promise<{ photoId: string }> {
  if (USE_MOCKS) {
    await delay(400);
    return mock.mockUploadPhoto(photo);
  }
  const form = new FormData();
  form.append("photo", photo);
  form.append("consent", "true");
  return request("/api/photos", { method: "POST", body: form });
}

export async function createBrief(input: BriefInput): Promise<BriefResponse> {
  if (USE_MOCKS) {
    await delay(900);
    return mock.mockBriefResponse(input);
  }
  return request("/api/briefs", { method: "POST", ...json(input) });
}

export async function selectProposal(proposal: Proposal): Promise<Proposal> {
  if (USE_MOCKS) {
    await delay(300);
    return mock.mockSelect(proposal);
  }
  return request(`${proposalPath(proposal.id)}/select`, { method: "POST" });
}

/** Change an item's size or lock state. Throws OutOfStockError when the size is gone. */
export async function updateItem(
  proposal: Proposal,
  itemId: string,
  patch: { size: string } | { locked: boolean },
): Promise<Proposal> {
  if (USE_MOCKS) {
    await delay(300);
    return mock.mockUpdateItem(proposal, itemId, patch);
  }
  return request(`${proposalPath(proposal.id)}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    ...json(patch),
  });
}

/** Ask the store for a different item; locked items stay. */
export async function replaceItem(proposal: Proposal, itemId: string, instruction?: string): Promise<Proposal> {
  if (USE_MOCKS) {
    await delay(700);
    return mock.mockReplace(proposal, itemId);
  }
  return request(`${proposalPath(proposal.id)}/replace`, { method: "POST", ...json({ itemId, instruction }) });
}

/** Start a YouCam try-on for one item; poll getPreview with the returned id. */
export async function startPreview(proposal: Proposal, itemId: string): Promise<{ previewId: string }> {
  if (USE_MOCKS) {
    await delay(300);
    return mock.mockStartPreview(itemId);
  }
  return request(`${proposalPath(proposal.id)}/previews`, { method: "POST", ...json({ itemId }) });
}

/** Turn a finished try-on preview into a 5-second video (YouCam image-to-video, 480p). */
export async function startVideo(proposal: Proposal, previewId: string): Promise<{ videoId: string }> {
  if (USE_MOCKS) {
    await delay(300);
    return mock.mockStartVideo(previewId);
  }
  return request(`${proposalPath(proposal.id)}/videos`, {
    method: "POST",
    ...json({ previewId, duration: 5, resolution: "480" }),
  });
}

export async function getVideo(videoId: string): Promise<TaskResult> {
  if (USE_MOCKS) {
    await delay(150);
    return mock.mockGetVideo(videoId);
  }
  return request(`/api/videos/${encodeURIComponent(videoId)}`, { method: "GET" });
}

export async function getPreview(previewId: string): Promise<TaskResult> {
  if (USE_MOCKS) {
    await delay(150);
    return mock.mockGetPreview(previewId);
  }
  return request(`/api/previews/${encodeURIComponent(previewId)}`, { method: "GET" });
}
