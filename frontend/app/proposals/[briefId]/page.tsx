"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { loadBrief, type StoredBrief } from "@/lib/briefStore";

// Placeholder until the proposals screen (task F4) is built.
export default function ProposalsPage({ params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = use(params);
  const [brief, setBrief] = useState<StoredBrief | null | undefined>(undefined);

  useEffect(() => {
    setBrief(loadBrief(briefId));
    document.title = "Your proposals · Look Exchange";
  }, [briefId]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:px-6">
      <h1 className="font-display text-h1 font-semibold text-ink">Your proposals</h1>
      {brief === null && (
        <p className="text-body text-muted">
          We couldn&apos;t find this brief.{" "}
          <Link href="/" className="font-medium text-sage underline">
            Post a new brief
          </Link>
        </p>
      )}
      {brief && (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {brief.response.proposals.map((p) => (
            <li key={p.id} className="rounded-card border border-line bg-surface p-6">
              <h2 className="font-display text-h2 font-medium text-ink">{p.storeName}</h2>
              <p className="mt-2 text-small text-muted">{p.rationale}</p>
              <p className="mt-4 text-price font-medium tabular-nums text-ink">Subtotal ${p.subtotal}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
