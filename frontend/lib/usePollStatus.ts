"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "./errors";
import type { TaskResult } from "./types";

export type PollState = TaskResult | { status: "timeout" };

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
  fetchRef.current = fetchStatus;

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
        result = await fetchRef.current(id);
      } catch (err) {
        // A dropped connection is not a failed task, so keep polling until the timeout.
        // Any other backend error (unknown task, server failure) ends polling.
        result =
          err instanceof ApiError && !err.network
            ? { status: "failed", error: err.message }
            : { status: "running" };
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
  }, [id, timeoutMs, restartKey]);

  return state;
}
