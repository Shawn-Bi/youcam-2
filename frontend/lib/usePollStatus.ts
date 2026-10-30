"use client";

import { useEffect, useState } from "react";
import type { TaskResult } from "./types";

export type PollState = TaskResult | { status: "timeout" };

type Options = {
  /** Give up after this long and report "timeout". */
  timeoutMs: number;
};

const FAST_MS = 2000;
const SLOW_MS = 5000;
const SLOW_AFTER_MS = 20000;

/**
 * Polls a slow task (YouCam try-on or video) until it succeeds, fails or times out.
 * Polls every 2 s, then every 5 s after 20 s. Pass a null id to stay idle.
 * Stops when the id changes or the component unmounts.
 */
export function usePollStatus(
  id: string | null,
  fetchStatus: (id: string) => Promise<TaskResult>,
  { timeoutMs }: Options,
): PollState | null {
  const [state, setState] = useState<PollState | null>(null);

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
      if (elapsed >= timeoutMs) {
        if (!cancelled) setState({ status: "timeout" });
        return;
      }
      let result: TaskResult;
      try {
        result = await fetchStatus(id);
      } catch {
        // A dropped request is not a failed task; keep polling until the timeout.
        result = { status: "running" };
      }
      if (cancelled) return;
      setState(result);
      if (result.status === "success" || result.status === "failed") return;
      timer = setTimeout(tick, elapsed > SLOW_AFTER_MS ? SLOW_MS : FAST_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, fetchStatus, timeoutMs]);

  return state;
}
