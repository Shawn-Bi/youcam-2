"use client";

import { useEffect, useState } from "react";
import { ApiError, getPreview, getVideo, startVideo } from "@/lib/api";
import { loadVideo, saveVideo } from "@/lib/briefStore";
import type { Proposal } from "@/lib/types";
import { usePollStatus } from "@/lib/usePollStatus";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { FrameLabel } from "./TryOnViewer";

const PREVIEW_TIMEOUT_MS = 90_000;
const VIDEO_TIMEOUT_MS = 4 * 60_000;

type Props = {
  proposal: Proposal;
  /** The try-on preview the video is made from (the outfit's main piece). */
  previewId: string | null;
  itemName: string;
};

/** On the picked store: turn the finished try-on preview into a 5-second AI video. */
export function VideoPanel({ proposal, previewId, itemName }: Props) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkAgain, setCheckAgain] = useState(0);
  const reducedMotion = useReducedMotion();
  // Each video costs YouCam units, so only a finished preview can be turned into one.
  const preview = usePollStatus(previewId, getPreview, { timeoutMs: PREVIEW_TIMEOUT_MS });
  const previewReady = preview?.status === "success" && Boolean(preview.imageUrl);
  const video = usePollStatus(videoId, getVideo, { timeoutMs: VIDEO_TIMEOUT_MS, restartKey: checkAgain });

  // A video belongs to the preview it was made from; a replaced item starts over.
  useEffect(() => setVideoId(loadVideo(proposal.id, previewId)), [proposal.id, previewId]);

  async function generate() {
    if (!previewId || !previewReady || starting) return;
    setError(null);
    setStarting(true);
    try {
      const { videoId: id } = await startVideo(proposal, previewId);
      saveVideo(proposal.id, previewId, id);
      setVideoId(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't start the video. Try again.");
    } finally {
      setStarting(false);
    }
  }

  const primary =
    "min-h-12 rounded-full bg-sage px-6 text-body font-medium text-on-sage hover:bg-sage-hover disabled:cursor-wait";
  const item = itemName.toLowerCase();

  let body: React.ReactNode;
  if (!previewId || preview?.status === "failed" || preview?.status === "timeout" || (preview?.status === "success" && !previewReady)) {
    body = <p className="text-body text-muted">Preview the {item} on your photo first, then make a video from it.</p>;
  } else if (!previewReady) {
    body = <p className="text-body text-muted">Your try-on preview is still being made. The video can start once it&apos;s ready.</p>;
  } else if (!videoId) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">A 5-second AI video of your look, made from your try-on preview. It takes about a minute.</p>
        <button type="button" onClick={generate} disabled={starting} className={primary}>
          {starting ? "Starting…" : "Generate video"}
        </button>
      </div>
    );
  } else if (video?.status === "success" && video.videoUrl) {
    body = (
      <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-line bg-surface">
        <video
          src={video.videoUrl}
          autoPlay={!reducedMotion}
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
  } else if (video?.status === "timeout") {
    // The video may still be rendering: check the same task again instead of paying for a new one.
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">The video is taking longer than usual. Your proposal works without it.</p>
        <button type="button" onClick={() => setCheckAgain((n) => n + 1)} className={primary}>
          Check again
        </button>
      </div>
    );
  } else if (video?.status === "failed" || video?.status === "success") {
    const message = video.status === "failed" ? (video.error ?? "The video didn't work this time.") : "The video finished but came back empty.";
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">{message} Your proposal works without it.</p>
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
