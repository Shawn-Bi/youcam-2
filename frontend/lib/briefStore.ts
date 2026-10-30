import type { BriefResponse } from "./types";

// Keeps the latest brief response for this tab so the proposals page can read it.
// Storage can be unavailable (private mode), so every access is guarded.
const KEY = "look-exchange:brief";

export function saveBrief(response: BriefResponse) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(response));
  } catch {
    // The proposals page shows a recoverable message when nothing was saved.
  }
}

export function loadBrief(briefId: string): BriefResponse | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BriefResponse;
    return parsed.briefId === briefId ? parsed : null;
  } catch {
    return null;
  }
}
