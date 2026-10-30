"use client";

import { useEffect, useState } from "react";
import { ApiError, getVideo, startVideo } from "@/lib/api";
import { loadVideo, saveVideo } from "@/lib/briefStore";
import type { Proposal } from "@/lib/types";
import { usePollStatus } from "@/lib/usePollStatus";
import { FrameLabel } from "./TryOnViewer";

const VIDEO_TIMEOUT_MS = 4 * 60_000;

type Props = {
  proposal: Proposal;
  /** The try-on preview the video is made from (the outfit's main piece). */
  previewId: string | null;
  itemName: string;
};

/** On the picked store: turn the try-on preview into a 5-second AI video. */
export function VideoPanel({ proposal, previewId, itemName }: Props) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = usePollStatus(videoId, getVideo, { timeoutMs: VIDEO_TIMEOUT_MS });

  useEffect(() => setVideoId(loadVideo(proposal.id)), [proposal.id]);

  async function generate() {
    if (!previewId || starting) return;
    setError(null);
    setStarting(true);
    try {
      const { videoId: id } = await startVideo(proposal, previewId);
      saveVideo(proposal.id, id);
      setVideoId(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't start the video. Try again.");
    } finally {
      setStarting(false);
    }
  }

  const primary =
    "min-h-12 rounded-full bg-sage px-6 text-body font-medium text-on-sage hover:bg-sage-hover disabled:cursor-wait";

  let body: React.ReactNode;
  if (!previewId) {
    body = <p className="text-body text-muted">Preview the {itemName.toLowerCase()} on your photo first, then make a video from it.</p>;
  } else if (!videoId) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">A 5-second AI video of your look, made from your try-on preview. It takes about a minute.</p>
        <button type="button" onClick={generate} disabled={starting} className={primary}>
          {starting ? "Starting…" : "Generate video"}
        </button>
      </div>
    );
  } else if (state?.status === "success" && state.videoUrl) {
    body = (
      <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-line bg-surface">
        <video
          src={state.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          controls
          aria-label={`AI-generated video of you in the ${proposal.storeName} look`}
          className="aspect-[3/4] w-full object-cover"
        />
        <FrameLabel ai>AI-generated video</FrameLabel>
      </div>
    );
  } else if (state?.status === "failed" || state?.status === "timeout" || state?.status === "success") {
    const message =
      state.status === "timeout"
        ? "The video is taking longer than usual."
        : state.status === "failed"
          ? (state.error ?? "The video didn't work this time.")
          : "The video finished but came back empty.";
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">{message} Your proposal is still saved without it.</p>
        <button type="button" onClick={generate} disabled={starting} className={primary}>
          Try again
        </button>
      </div>
    );
  } else {
    body = (
      <div className="flex w-full max-w-sm flex-col gap-3" aria-live="polite">
        <p className="text-body text-ink">Making your video…</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage-tint">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-terracotta" />
        </div>
        <p className="text-small text-muted">This usually takes about a minute. You can keep editing meanwhile.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="video-heading" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-6">
      <h2 id="video-heading" className="font-display text-h2 font-medium text-ink">
        Video of your look
      </h2>
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      {body}
    </section>
  );
}
