"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { sizeLabel } from "@/components/ProposalCard";
import { FrameLabel } from "@/components/TryOnViewer";
import { getPreview, getVideo } from "@/lib/api";
import { loadBrief, loadPreviews, loadVideo } from "@/lib/briefStore";
import { formatPrice } from "@/lib/format";
import { isShopPath, isWebUrl, mainItem } from "@/lib/items";
import type { Proposal } from "@/lib/types";
import { usePollStatus } from "@/lib/usePollStatus";
import { useReducedMotion } from "@/lib/useReducedMotion";

import { PREVIEW_TIMEOUT_MS, VIDEO_TIMEOUT_MS } from "@/lib/generation";

type Saved = { proposal: Proposal; previewId: string | null; videoId: string | null };

export default function SavedPage({ params }: { params: Promise<{ briefId: string; proposalId: string }> }) {
  const { briefId, proposalId } = use(params);
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);

  useEffect(() => {
    const proposal = loadBrief(briefId)?.response.proposals.find((p) => p.id === proposalId) ?? null;
    if (!proposal) {
      setSaved(null);
      return;
    }
    document.title = `Your ${proposal.storeName} look · Look Exchange`;
    const main = mainItem(proposal);
    const previewId = main ? (loadPreviews(proposal.id)[main.itemId] ?? null) : null;
    setSaved({ proposal, previewId, videoId: loadVideo(proposal.id, previewId) });
  }, [briefId, proposalId]);

  const [checkAgain, setCheckAgain] = useState(0);
  const preview = usePollStatus(saved?.previewId ?? null, getPreview, { timeoutMs: PREVIEW_TIMEOUT_MS, restartKey: checkAgain });
  const video = usePollStatus(saved?.videoId ?? null, getVideo, { timeoutMs: VIDEO_TIMEOUT_MS, restartKey: checkAgain });
  const reducedMotion = useReducedMotion();

  if (saved === undefined) return <main className="mx-auto max-w-page px-4 py-10 md:px-8 lg:px-12" aria-busy="true" />;

  if (saved === null) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="font-display text-h1 font-medium text-ink">We couldn&apos;t find this look</h1>
        <p className="text-body text-muted">Saved looks are kept only while this tab is open.</p>
        <Link href="/brief" className="self-start rounded-full bg-sage px-6 py-3 text-body font-medium text-on-sage hover:bg-sage-hover">
          Start a new brief
        </Link>
      </main>
    );
  }

  const { proposal } = saved;
  const previewUrl = preview?.status === "success" ? preview.imageUrl : undefined;
  const videoUrl = video?.status === "success" ? video.videoUrl : undefined;
  const videoPending = saved.videoId && (video === null || video.status === "queued" || video.status === "running");

  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:px-8 lg:px-12 md:py-12">
      <div className="flex flex-col gap-1">
        <Link
          href={`/proposals/${briefId}/${proposal.id}`}
          className="inline-flex min-h-11 items-center self-start text-small font-medium text-sage underline"
        >
          Back to editing
        </Link>
        <h1 className="font-display text-h1 font-medium text-ink md:text-display">Your {proposal.storeName} look</h1>
        <p className="text-small text-muted">Saved for this session.</p>
      </div>

      {[preview, video].some((task) => task && ["timeout", "uncertain", "unavailable"].includes(task.status)) && (
        <div role="status" className="flex flex-col items-start gap-2">
          <p className="text-small text-muted">Some results are not confirmed yet.</p>
          <button type="button" onClick={() => setCheckAgain((n) => n + 1)} className="min-h-11 text-small font-medium text-sage underline">Check existing tasks again</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {previewUrl || videoUrl || videoPending ? (
          <div className="grid grid-cols-1 gap-3 self-start sm:grid-cols-2">
            {previewUrl && (
              <div className="relative aspect-[3/4] overflow-hidden rounded-card border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={`You wearing the ${proposal.storeName} look`} className="size-full object-cover" />
                <FrameLabel ai>AI-generated preview</FrameLabel>
              </div>
            )}
            {videoUrl ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-card border border-line bg-surface">
                <video
                  src={videoUrl}
                  autoPlay={!reducedMotion}
                  muted
                  loop
                  playsInline
                  controls
                  aria-label={`AI-generated video of you in the ${proposal.storeName} look`}
                  className="size-full object-cover"
                />
                <FrameLabel ai>AI-generated video</FrameLabel>
              </div>
            ) : (
              videoPending && (
                <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-small text-muted" aria-live="polite">
                  Your video is still being made…
                </p>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1 self-start rounded-card border border-line bg-surface px-4 py-4">
            <p className="text-small text-muted">Your try-on results are not available yet.</p>
            <Link
              href={`/proposals/${briefId}/${proposal.id}`}
              className="inline-flex min-h-11 items-center text-small font-medium text-sage underline"
            >
              Make one
            </Link>
          </div>
        )}

        <section aria-labelledby="items-heading" className="flex flex-col gap-4 self-start rounded-card border border-line bg-surface p-4 md:p-6">
          <h2 id="items-heading" className="font-display text-h2 font-medium text-ink">
            What&apos;s in it
          </h2>
          <ul className="flex flex-col gap-3">
            {proposal.items.map((item) => (
              <li key={item.itemId} className="flex gap-3">
                <div className="w-16 shrink-0">
                  <ProductImage src={item.imageUrl} alt="" category={item.category} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-small font-medium text-ink">{item.name}</p>
                    <p className="text-small font-medium tabular-nums text-ink">{formatPrice(item.price)}</p>
                  </div>
                  <p className="text-small text-muted">{sizeLabel(item)}</p>
                  {isShopPath(item.productUrl) ? (
                    <Link
                      href={item.productUrl}
                      className="inline-flex min-h-11 items-center self-start text-small font-medium text-sage underline"
                    >
                      View in the {proposal.storeName} shop
                    </Link>
                  ) : isWebUrl(item.productUrl) ? (
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center self-start text-small font-medium text-sage underline"
                    >
                      View at {proposal.storeName}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="text-small text-muted">Store link not available</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {proposal.kept.length > 0 && <p className="text-small text-muted">Keeping: {proposal.kept.join(", ")}</p>}
          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-small text-muted">Subtotal</span>
            <span className="text-price font-medium tabular-nums text-ink">{formatPrice(proposal.subtotal)}</span>
          </div>
          <Link
            href="/brief"
            className="flex min-h-12 items-center justify-center rounded-full bg-sage px-6 text-body font-medium text-on-sage hover:bg-sage-hover"
          >
            Start a new brief
          </Link>
        </section>
      </div>
    </main>
  );
}
