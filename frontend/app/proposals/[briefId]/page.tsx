"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { NoMatchCard, ProposalCard } from "@/components/ProposalCard";
import { ApiError, createBrief, selectProposal } from "@/lib/api";
import { loadBrief, saveBrief, saveProposal, type StoredBrief } from "@/lib/briefStore";
import { formatPrice, raisedBudget } from "@/lib/format";
import type { Proposal } from "@/lib/types";

function heading(matches: number) {
  if (matches === 0) return "No store found a match";
  if (matches === 1) return "1 store answered your brief";
  return `${matches} stores answered your brief`;
}

export default function ProposalsPage({ params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = use(params);
  const router = useRouter();
  const [brief, setBrief] = useState<StoredBrief | null | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBrief(loadBrief(briefId));
    document.title = "Your proposals · Look Exchange";
  }, [briefId]);

  async function pick(proposal: Proposal) {
    setError(null);
    setBusyId(proposal.id);
    try {
      const selected = await selectProposal(proposal);
      saveProposal(briefId, selected);
      router.push(`/proposals/${briefId}/${proposal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't pick that store. Try again.");
      setBusyId(null);
    }
  }

  async function raiseBudget(proposal: Proposal) {
    if (!brief) return;
    setError(null);
    setBusyId(proposal.id);
    try {
      const input = { ...brief.input, budget: raisedBudget(brief.input.budget) };
      const response = await createBrief(input);
      saveBrief(input, response);
      router.replace(`/proposals/${response.briefId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't ask the stores again. Try again.");
      setBusyId(null);
    }
  }

  if (brief === undefined) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:px-6" aria-busy="true">
        <div className="h-10 w-2/3 rounded-field bg-sage-tint" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-96 rounded-card border border-line bg-surface" />
          <div className="h-96 rounded-card border border-line bg-surface" />
        </div>
      </main>
    );
  }

  if (brief === null) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="font-display text-h1 font-semibold text-ink">We couldn&apos;t find this brief</h1>
        <p className="text-body text-muted">Briefs are kept only while this tab is open.</p>
        <Link href="/" className="self-start rounded-full bg-sage px-6 py-3 text-body font-medium text-on-sage hover:bg-sage-hover">
          Post a new brief
        </Link>
      </main>
    );
  }

  const { input, response } = brief;
  const matches = response.proposals.filter((p) => p.items.length > 0).length;
  const sizes = input.sizes.bottom ? `Top ${input.sizes.top}, bottoms ${input.sizes.bottom}` : `Top ${input.sizes.top}`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:gap-8 md:px-6 md:py-14">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-h1 font-semibold text-ink md:text-display">{heading(matches)}</h1>
        <p className="text-small text-muted">
          <span className="text-ink">&ldquo;{input.text}&rdquo;</span> · Budget {formatPrice(input.budget)} · {sizes}{" "}
          · <Link href="/" className="font-medium text-sage underline">Edit brief</Link>
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-field border border-danger/40 bg-surface px-4 py-3 text-small text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {response.proposals.map((p) =>
          p.items.length > 0 ? (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busyId === p.id}
              onPreview={() => router.push(`/proposals/${briefId}/${p.id}`)}
              onPick={() => pick(p)}
            />
          ) : (
            <NoMatchCard
              key={p.id}
              proposal={p}
              budget={input.budget}
              nextBudget={raisedBudget(input.budget)}
              busy={busyId === p.id}
              onRaiseBudget={() => raiseBudget(p)}
            />
          ),
        )}
      </div>
    </main>
  );
}
