"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { ApiError, getPreview, getVideo, startVideo } from "@/lib/api";
import { loadVideo, saveVideo } from "@/lib/briefStore";
import type { Proposal } from "@/lib/types";
import { usePollStatus } from "@/lib/usePollStatus";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { FrameLabel } from "./TryOnViewer";
import { PREVIEW_TIMEOUT_MS, VIDEO_TIMEOUT_MS, elapsedLabel, generationProgress } from "@/lib/generation";

type Props = {
  proposal: Proposal;
  /** The try-on preview the video is made from (the outfit's main piece). */
  previewId: string | null;
  itemName: string;
  /** A finished video to play as it is; the example page uses this and never asks the backend. */
  finished?: { videoUrl: string; poster?: string };
};

/** On the picked store: turn the finished try-on preview into a 5-second AI video. */
export function VideoPanel({ proposal, previewId, itemName, finished }: Props) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkAgain, setCheckAgain] = useState(0);
  const [previewCheck, setPreviewCheck] = useState(0);
  const reducedMotion = useReducedMotion();
  // Each video costs YouCam units, so only a finished preview can be turned into one.
  const preview = usePollStatus(previewId, getPreview, { timeoutMs: PREVIEW_TIMEOUT_MS, restartKey: previewCheck });
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

  const player = (videoUrl: string, poster?: string) => (
    <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-line bg-surface">
      <video
        src={videoUrl}
        poster={poster}
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        controls
        onLoadStart={(event) => { event.currentTarget.dataset.loadStarted = String(performance.now()); }}
        onLoadedData={(event) => console.info("Look Exchange timing", {
          phase: "video_playback_ready",
          elapsedMs: Math.round(performance.now() - Number(event.currentTarget.dataset.loadStarted ?? performance.now())),
        })}
        aria-label={`AI-generated video of ${finished ? "the example shopper" : "you"} in the ${proposal.storeName} look`}
        className="aspect-[3/4] w-full object-cover"
      />
      <FrameLabel ai>AI-generated video</FrameLabel>
    </div>
  );

  let body: React.ReactNode;
  if (finished) {
    body = player(finished.videoUrl, finished.poster);
  } else if (video?.status === "success" && video.videoUrl) {
    body = player(video.videoUrl);
  } else if (videoId && (video?.status === "timeout" || video?.status === "uncertain" || video?.status === "unavailable")) {
    body = (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">{video.error ?? "The video is taking longer. Your proposal works without it."}</p>
        <button type="button" onClick={() => setCheckAgain((n) => n + 1)} className={primary}>Check again</button>
        <p className="text-small text-muted">This checks the same task without starting another generation.</p>
        {video.status === "unavailable" && <Link href="/brief" className="text-small text-sage underline">Start a new brief (new generation may cost units again)</Link>}
      </div>
    );
  } else if (previewId && (preview?.status === "timeout" || preview?.status === "uncertain" || preview?.status === "unavailable")) {
    body = <div role="status" className="flex flex-col items-start gap-3">
      <p className="text-body text-muted">The preview is not confirmed yet. Check it again before making a video.</p>
      <button type="button" className={primary} onClick={() => setPreviewCheck((n) => n + 1)}>Check preview again</button>
      {preview.status === "unavailable" && <Link href="/brief" className="text-small text-sage underline">Start a new brief (new generation may cost units again)</Link>}
    </div>;
  } else if (!previewId || preview?.status === "failed" || (preview?.status === "success" && !previewReady)) {
    body = <p className="text-body text-muted">Preview the {item} on your photo first, then make a video from it.</p>;
  } else if (!previewReady) {
    body = <p className="text-body text-muted">Your try-on preview is still being made. The video can start once it&apos;s ready.</p>;
  } else if (!videoId) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">A 5-second AI video of your look, made from your try-on preview. Generation can take several minutes.</p>
        <button type="button" onClick={generate} disabled={starting} className={primary}>
          {starting ? "Starting…" : "Generate video"}
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
        <p className="text-body text-ink">{generationProgress(video?.phase)}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage-tint">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-terracotta" />
        </div>
        <p className="text-small text-muted">{elapsedLabel(video?.elapsedSeconds)}. This can take several minutes. You can keep editing meanwhile.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="video-heading" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-6">
      <h2 id="video-heading" className="font-display text-h2 font-medium text-ink">
        {finished ? "Video of this look" : "Video of your look"}
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
