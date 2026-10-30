import type { BriefInput, BriefResponse, Proposal } from "./types";

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

/** Replaces one proposal in the stored brief, e.g. after it was selected or revised. */
export function saveProposal(briefId: string, proposal: Proposal) {
  const stored = loadBrief(briefId);
  if (!stored) return;
  const proposals = stored.response.proposals.map((p) => (p.id === proposal.id ? proposal : p));
  saveBrief(stored.input, { ...stored.response, proposals });
}

/** The most recent brief in this tab, used to refill the form when the shopper edits it. */
export function loadLatestBrief(): StoredBrief | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredBrief) : null;
  } catch {
    return null;
  }
}

export function loadBrief(briefId: string): StoredBrief | null {
  const latest = loadLatestBrief();
  return latest?.response?.briefId === briefId ? latest : null;
}
