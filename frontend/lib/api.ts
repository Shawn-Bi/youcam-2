import { mockBriefResponse, mockSelect } from "@/mocks/data";
import type { BriefInput, BriefResponse, FieldErrors, Proposal } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** The backend rejected some fields (HTTP 422). */
export class ValidationError extends Error {
  constructor(public fields: FieldErrors) {
    super("Some fields need attention.");
  }
}

/** The backend could not be reached or failed. */
export class ApiError extends Error {}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new ApiError("We couldn't reach Look Exchange. Check your connection and try again.");
  }
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    throw new ValidationError(body.errors ?? {});
  }
  if (!res.ok) {
    throw new ApiError("Something went wrong on our side. Try again in a moment.");
  }
  return res.json() as Promise<T>;
}

export async function uploadPhoto(photo: File): Promise<{ photoId: string }> {
  if (USE_MOCKS) {
    await delay(400);
    return { photoId: "photo_demo" };
  }
  const form = new FormData();
  form.append("photo", photo);
  form.append("consent", "true");
  return request("/api/photos", { method: "POST", body: form });
}

export async function createBrief(input: BriefInput): Promise<BriefResponse> {
  if (USE_MOCKS) {
    await delay(900);
    return mockBriefResponse(input);
  }
  return request("/api/briefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function selectProposal(proposal: Proposal): Promise<Proposal> {
  if (USE_MOCKS) {
    await delay(300);
    return mockSelect(proposal);
  }
  return request(`/api/proposals/${encodeURIComponent(proposal.id)}/select`, { method: "POST" });
}
