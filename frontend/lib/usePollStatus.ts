"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "./errors";
import type { TaskResult } from "./types";

export type PollState = TaskResult | { status: "timeout" | "unavailable"; error?: string; phase?: string; elapsedSeconds?: number };

type Options = {
  /** Give up after this long and report "timeout". */
  timeoutMs: number;
  /** Change this to check the same task again after a timeout, without starting a new one. */
  restartKey?: number;
};

const FAST_MS = 2000;
const SLOW_MS = 5000;
const SLOW_AFTER_MS = 20000;

/**
 * Polls a slow task (YouCam try-on or video) until it succeeds, fails or times out.
 * Polls every 2 s, then every 5 s after 20 s. Pass a null id to stay idle.
 * Stops when the id changes or the component unmounts. `fetchStatus` may be an
 * inline function; only a new id restarts polling.
 */
export function usePollStatus(
  id: string | null,
  fetchStatus: (id: string) => Promise<TaskResult>,
  { timeoutMs, restartKey = 0 }: Options,
): PollState | null {
  const [state, setState] = useState<PollState | null>(null);
  const fetchRef = useRef(fetchStatus);
  useEffect(() => {
    fetchRef.current = fetchStatus;
  });

  useEffect(() => {
    if (!id) {
      setState(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    setState({ status: "queued" });

    const tick = async () => {
      const elapsed = Date.now() - startedAt;
      let result: TaskResult;
      try {
        result = await fetchRef.current(id);
      } catch (err) {
        // Status-read errors never prove that generation failed. Never offer a paid retry here.
        if (err instanceof ApiError && !err.network && err.status && err.status < 500 && err.status !== 429) {
          if (!cancelled) setState({ status: "unavailable", error: "We cannot retrieve this task right now. Your session may have expired. Starting over could create another charge." });
          return;
        }
        result = { status: "running" };
      }
      if (cancelled) return;
      const elapsedSeconds = Math.max(Math.floor((Date.now() - startedAt) / 1000), result.elapsedSeconds ?? 0);
      setState({ ...result, elapsedSeconds });
      if (result.status === "success" || result.status === "failed" || result.status === "uncertain") {
        console.info("Look Exchange timing", { phase: "generation_observed", outcome: result.status, elapsedSeconds });
        return;
      }
      // Read once at the boundary before declaring the browser's waiting window over.
      if (Date.now() - startedAt >= timeoutMs) {
        setState({ status: "timeout", elapsedSeconds });
        return;
      }
      timer = setTimeout(tick, elapsed > SLOW_AFTER_MS ? SLOW_MS : FAST_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, timeoutMs, restartKey]);

  return state;
}
