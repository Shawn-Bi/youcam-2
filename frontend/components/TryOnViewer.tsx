"use client";

import { getPreview } from "@/lib/api";
import type { Item } from "@/lib/types";
import { usePollStatus } from "@/lib/usePollStatus";
import { ProductImage } from "./ProductImage";

const PREVIEW_TIMEOUT_MS = 90_000;

const outlineButton =
  "min-h-11 rounded-full border border-sage px-6 text-small font-medium text-sage hover:bg-sage-tint";

function FrameLabel({ children, ai = false }: { children: React.ReactNode; ai?: boolean }) {
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
  onStart: () => void;
  starting: boolean;
};

/** The selected item's try-on preview beside its product photo. */
export function TryOnViewer({ item, previewId, onStart, starting }: Props) {
  const state = usePollStatus(previewId, getPreview, { timeoutMs: PREVIEW_TIMEOUT_MS });

  let tryOn: React.ReactNode;
  if (!previewId) {
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
  } else if (state?.status === "failed" || state?.status === "timeout" || state?.status === "success") {
    const message =
      state.status === "timeout"
        ? "This preview is taking longer than usual."
        : state.status === "failed"
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
        <p className="text-body text-ink">Creating your preview…</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage-tint">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-terracotta" />
        </div>
        <p className="text-small text-muted">This usually takes under a minute.</p>
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
