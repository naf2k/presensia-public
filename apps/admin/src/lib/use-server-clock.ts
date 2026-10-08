"use client";

import { useEffect, useState } from "react";

/**
 * Device-independent clock: server timestamp plus locally elapsed time.
 * Resyncs whenever the server timestamp or fetch time changes.
 */
export function useServerClock(serverNow: string | undefined, fetchedAt: number, intervalMs = 1000) {
  const serverMs = serverNow ? Date.parse(serverNow) : NaN;
  const offset = Number.isFinite(serverMs) ? serverMs - fetchedAt : 0;
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(timer);
  }, [offset, intervalMs]);
  return new Date(now);
}
