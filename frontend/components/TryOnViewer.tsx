"use client";

import Link from "next/link";

import { getPreview } from "@/lib/api";
import { useState } from "react";
import { PREVIEW_TIMEOUT_MS, elapsedLabel, generationProgress } from "@/lib/generation";
import type { Item } from "@/lib/types";
import { usePollStatus } from "@/lib/usePollStatus";
import { ProductImage } from "./ProductImage";

const outlineButton =
  "min-h-11 rounded-full border border-sage px-6 text-small font-medium text-sage hover:bg-sage-tint hover:text-sage-hover";

export function FrameLabel({ children, ai = false }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-label font-medium">
      {ai && <span aria-hidden="true" className="size-2 rounded-full bg-terracotta" />}
      <span className={ai ? "text-terracotta-text" : "text-ink"}>{children}</span>
    </span>
  );
}

type Props = {
  item: Item;
  previewId: string | null;
  onStart?: () => void;
  starting?: boolean;
  /** A finished try-on to show as it is; the example page uses this and never asks the backend. */
  finished?: { imageUrl: string; alt: string };
};

/** The selected item's try-on preview beside its product photo. */
export function TryOnViewer({ item, previewId, onStart, starting, finished }: Props) {
  const [checkAgain, setCheckAgain] = useState(0);
  const state = usePollStatus(previewId, getPreview, { timeoutMs: PREVIEW_TIMEOUT_MS, restartKey: checkAgain });

  let tryOn: React.ReactNode;
  if (finished) {
    tryOn = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={finished.imageUrl} alt={finished.alt} className="size-full object-cover" />
        <FrameLabel ai>AI-generated preview</FrameLabel>
      </>
    );
  } else if (!previewId) {
    tryOn = (
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <p className="text-body text-ink">See the {item.name.toLowerCase()} on your photo.</p>
        <button type="button" onClick={onStart} disabled={starting} className={outlineButton}>
          {starting ? "Starting…" : "Preview on me"}
        </button>
      </div>
    );
  } else if (state?.status === "success" && state.imageUrl) {
    tryOn = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.imageUrl} alt={`You wearing the ${item.name}`} className="size-full object-cover" />
        <FrameLabel ai>AI-generated preview</FrameLabel>
      </>
    );
  } else if (state?.status === "uncertain" || state?.status === "unavailable" || state?.status === "timeout") {
    tryOn = (
      <div role="status" className="flex flex-col items-center gap-3 px-6 text-center">
        <p className="text-body text-ink">{state.error ?? "Your preview is taking longer. Check the same task again without starting another generation."}</p>
        <button type="button" onClick={() => setCheckAgain((n) => n + 1)} className={outlineButton}>Check again</button>
        {state.status === "unavailable" && <Link href="/brief" className="text-small text-sage underline">Start a new brief (new generation may cost units again)</Link>}
      </div>
    );
  } else if (state?.status === "failed" || state?.status === "success") {
    const message =
      state.status === "failed"
          ? (state.error ?? "The preview didn't work this time.")
          : "The preview finished but came back empty.";
    tryOn = (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 text-center">
        <p className="text-body text-ink">{message}</p>
        <button type="button" onClick={onStart} disabled={starting} className={outlineButton}>
          Try again
        </button>
      </div>
    );
  } else {
    tryOn = (
      <div className="flex w-full max-w-xs flex-col gap-3 px-6 text-center" aria-live="polite">
        <p className="text-body text-ink">{generationProgress(state?.phase)}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage-tint">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-terracotta" />
        </div>
        <p className="text-small text-muted">{elapsedLabel(state?.elapsedSeconds)}. Previews can take several minutes.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[3fr_2fr]">
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-card border border-line bg-surface">
        {tryOn}
      </div>
      <div className="relative self-start">
        <ProductImage src={item.imageUrl} alt={item.name} category={item.category} />
        <FrameLabel>Product photo</FrameLabel>
      </div>
    </div>
  );
}
