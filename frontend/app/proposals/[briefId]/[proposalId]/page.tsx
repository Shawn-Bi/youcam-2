"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { loadBrief } from "@/lib/briefStore";
import type { Proposal } from "@/lib/types";

// Placeholder until the preview and revise screen (task F5) is built.
export default function PreviewPage({ params }: { params: Promise<{ briefId: string; proposalId: string }> }) {
  const { briefId, proposalId } = use(params);
  const [proposal, setProposal] = useState<Proposal | null | undefined>(undefined);

  useEffect(() => {
    const found = loadBrief(briefId)?.response.proposals.find((p) => p.id === proposalId) ?? null;
    setProposal(found);
    if (found) document.title = `${found.storeName} · Look Exchange`;
  }, [briefId, proposalId]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-h1 font-semibold text-ink">{proposal ? proposal.storeName : "Preview"}</h1>
      {proposal?.selected && <p className="text-body text-ink">You picked this store.</p>}
      <p className="text-body text-muted">Try-on previews and editing come next.</p>
      <Link href={`/proposals/${briefId}`} className="self-start font-medium text-sage underline">
        Back to proposals
      </Link>
    </main>
  );
}
