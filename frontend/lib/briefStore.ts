import type { BriefInput, BriefResponse } from "./types";

// Keeps the latest brief (what the shopper asked for and what the stores answered)
// for this tab so later pages can read it. Storage can be unavailable (private mode),
// so every access is guarded.
const KEY = "look-exchange:brief";

export type StoredBrief = {
  input: BriefInput;
  response: BriefResponse;
};

export function saveBrief(input: BriefInput, response: BriefResponse) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ input, response } satisfies StoredBrief));
  } catch {
    // Pages that need the brief show a recoverable message when nothing was saved.
  }
}

export function loadBrief(briefId: string): StoredBrief | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBrief;
    return parsed.response?.briefId === briefId ? parsed : null;
  } catch {
    return null;
  }
}
