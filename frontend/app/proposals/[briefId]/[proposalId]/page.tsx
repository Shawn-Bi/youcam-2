"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { ItemRow } from "@/components/ItemRow";
import { TryOnViewer } from "@/components/TryOnViewer";
import { VideoPanel } from "@/components/VideoPanel";
import { ApiError, OutOfStockError, replaceItem, selectProposal, startPreview, updateItem } from "@/lib/api";
import { loadBrief, loadPreviews, savePreviews, saveProposal } from "@/lib/briefStore";
import { formatPrice } from "@/lib/format";
import { mainItem } from "@/lib/items";
import type { Item, Proposal } from "@/lib/types";


export default function PreviewPage({ params }: { params: Promise<{ briefId: string; proposalId: string }> }) {
  const { briefId, proposalId } = use(params);
  const [proposal, setProposal] = useState<Proposal | null | undefined>(undefined);
  const [budget, setBudget] = useState(0);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [startingId, setStartingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Item[]>([]);
  // Each try-on costs YouCam units, so the automatic first preview must start at most once.
  const autoStarted = useRef(false);

  // Load the proposal; start the first apparel preview when the shopper came from "Preview on me".
  useEffect(() => {
    const stored = loadBrief(briefId);
    const found = stored?.response.proposals.find((p) => p.id === proposalId) ?? null;
    setProposal(found);
    if (!stored || !found) return;
    document.title = `${found.storeName} · Look Exchange`;
    setBudget(stored.input.budget);
    const first = mainItem(found);
    setViewingId(first?.itemId ?? null);
    const saved = loadPreviews(found.id);
    setPreviews(saved);
    const wantsPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    if (wantsPreview && first && !saved[first.itemId] && !autoStarted.current) {
      autoStarted.current = true;
      void requestPreview(found, first.itemId);
    }
  }, [briefId, proposalId]);

  function commit(next: Proposal) {
    setProposal(next);
    saveProposal(briefId, next);
  }

  async function requestPreview(target: Proposal, itemId: string) {
    setError(null);
    setStartingId(itemId);
    try {
      const { previewId } = await startPreview(target, itemId);
      // Merge into the latest map: another preview may have started meanwhile.
      setPreviews((prev) => {
        const next = { ...prev, [itemId]: previewId };
        savePreviews(target.id, next);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't start the preview. Try again.");
    } finally {
      setStartingId((current) => (current === itemId ? null : current));
    }
  }

  async function run(action: () => Promise<Proposal>, fallback: string) {
    setError(null);
    setAlternatives([]);
    setBusy(true);
    try {
      return await action();
    } catch (err) {
      if (err instanceof OutOfStockError) {
        setError("That size just sold out. Pick another size or replace the item.");
        setAlternatives(err.alternatives);
      } else setError(err instanceof ApiError ? err.message : fallback);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function changeSize(itemId: string, size: string) {
    if (!proposal) return;
    const next = await run(() => updateItem(proposal, itemId, { size }), "We couldn't change the size. Try again.");
    if (next) commit(next);
  }

  async function toggleLock(itemId: string, locked: boolean) {
    if (!proposal) return;
    const next = await run(() => updateItem(proposal, itemId, { locked }), "We couldn't update that item. Try again.");
    if (next) commit(next);
  }

  async function replace(itemId: string) {
    if (!proposal) return;
    const text = instruction.trim() || undefined;
    const next = await run(() => replaceItem(proposal, itemId, text), "We couldn't replace that item. Try again.");
    if (!next) return;
    commit(next);
    setInstruction("");
    // The replaced item has a new id; keep it in view so its "Preview on me" is the next step.
    const replaced = next.items.find((i) => !proposal.items.some((old) => old.itemId === i.itemId));
    if (replaced && viewingId === itemId) setViewingId(replaced.itemId);
  }

  async function pick() {
    if (!proposal) return;
    const next = await run(() => selectProposal(proposal), "We couldn't pick this store. Try again.");
    if (next) commit(next);
  }

  if (proposal === undefined) {
    return <main className="mx-auto max-w-page px-4 py-10 md:px-8 lg:px-12" aria-busy="true" />;
  }

  if (proposal === null) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="font-display text-h1 font-medium text-ink">We couldn&apos;t find this proposal</h1>
        <p className="text-body text-muted">Proposals are kept only while this tab is open.</p>
        <Link href="/brief" className="self-start rounded-full bg-sage px-6 py-3 text-body font-medium text-on-sage hover:bg-sage-hover">
          Post a new brief
        </Link>
      </main>
    );
  }

  const viewing = proposal.items.find((i) => i.itemId === viewingId) ?? proposal.items[0];
  const overBudget = budget > 0 && proposal.subtotal > budget;
  // The video is made from the outfit's main piece (the jacket or top), not the bag.
  const videoItem = mainItem(proposal);

  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:px-8 lg:px-12 md:py-12">
      <div className="flex flex-col gap-1">
        <Link href={`/proposals/${briefId}`} className="inline-flex min-h-11 items-center self-start text-small font-medium text-sage underline">
          Back to proposals
        </Link>
        <h1 className="font-display text-h1 font-medium text-ink">{proposal.storeName}</h1>
        <p className="text-small text-muted">{proposal.rationale}</p>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-2 rounded-field border border-danger/40 bg-surface px-4 py-3">
          <p className="text-small text-danger">{error}</p>
          {alternatives.length > 0 && (
            <>
              <p className="text-small text-ink">{proposal.storeName} has these in your size:</p>
              <ul className="flex flex-col gap-1">
                {alternatives.map((alt) => (
                  <li key={alt.itemId} className="text-small text-ink">
                    {alt.name} · {formatPrice(alt.price)}
                    {alt.sizesInStock.length > 0 && ` · ${alt.sizesInStock.join(", ")}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {viewing && (
          <TryOnViewer
            key={viewing.itemId}
            item={viewing}
            previewId={previews[viewing.itemId] ?? null}
            starting={startingId === viewing.itemId}
            onStart={() => requestPreview(proposal, viewing.itemId)}
          />
        )}

        <section aria-labelledby="edit-heading" className="flex flex-col gap-4 self-start rounded-card border border-line bg-surface p-4 md:p-6">
          <h2 id="edit-heading" className="font-display text-h2 font-medium text-ink">
            Edit your proposal
          </h2>
          <ul className="flex flex-col gap-1">
            {proposal.items.map((item) => (
              <ItemRow
                key={item.itemId}
                item={item}
                viewing={item.itemId === viewing?.itemId}
                busy={busy}
                onView={() => setViewingId(item.itemId)}
                onSize={(size) => changeSize(item.itemId, size)}
                onToggleLock={() => toggleLock(item.itemId, !item.locked)}
                onReplace={() => replace(item.itemId)}
              />
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <label htmlFor="replace-instruction" className="text-small font-medium text-ink">
              What should a replacement be like? <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="replace-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Cheaper, more silver"
              className="rounded-field border border-line bg-surface px-3 py-2.5 text-body text-ink placeholder:text-muted"
            />
          </div>

          {proposal.kept.length > 0 && (
            <p className="text-small text-muted">Keeping: {proposal.kept.join(", ")}</p>
          )}

          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-small text-muted">Subtotal</span>
            <span className={`text-price font-medium tabular-nums ${overBudget ? "text-danger" : "text-ink"}`}>
              {formatPrice(proposal.subtotal)}
            </span>
          </div>
          {overBudget && (
            <p className="text-small text-danger">Over your {formatPrice(budget)} budget. Replace an item to bring it down.</p>
          )}

          {proposal.selected ? (
            <div className="flex flex-col gap-3">
              <p className="rounded-field bg-sage-tint px-4 py-3 text-small text-ink">You picked {proposal.storeName}.</p>
              <Link
                href={`/saved/${briefId}/${proposal.id}`}
                className="flex min-h-12 items-center justify-center rounded-full border border-line px-6 text-body font-medium text-ink hover:bg-sage-tint"
              >
                Save proposal
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={pick}
              disabled={busy}
              className="min-h-12 rounded-full bg-sage px-6 text-body font-medium text-on-sage hover:bg-sage-hover disabled:cursor-wait"
            >
              Pick this store
            </button>
          )}
        </section>
      </div>

      {proposal.selected && videoItem && (
        <VideoPanel proposal={proposal} previewId={previews[videoItem.itemId] ?? null} itemName={videoItem.name} />
      )}
    </main>
  );
}
